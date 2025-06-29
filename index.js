const express = require('express');
const app = express();
const server = require('http').Server(app);
const fs = require('fs');
const electron = require('electron');
const semver = require('semver');
const bcrypt = require('bcryptjs');
const os = require('os');
const https = require('https');
const expressLicense = require('express-license');
let CHANGED_SAVE_TYPE = false;
const { autoUpdater } = require('electron-updater');

const StageManager = require('./StageManager');

const appPath = electron.app.getPath('userData');

const configAtInit = require(`${appPath}/config.json`)


const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let address;

function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    throw new Error('No external IPv4 address found');
}

try {
    address = getLocalIPAddress();
    console.log(`Local IPv4 Address: ${address}`);
} catch (error) {
electron.dialog.showErrorBox('IP Address Error', 'Could not find local IP address. Please check your network connection and restart the app.');
electron.app.quit();
}

const socketAdmin = () => {
    return configAtInit.socketAdmin == 'production' || configAtInit.socketAdmin == 'development'
}

if(!configAtInit.adminUser) configAtInit.adminUser = 'admin';
if(!configAtInit.adminPass) configAtInit.adminPass = bcrypt.hashSync('admin', 10);

if(socketAdmin()) {
    console.log('Admin UI enabled');
    require('@socket.io/admin-ui').instrument(io, {
        auth: {
            type: "basic",
            username: configAtInit.adminUser,
            password: configAtInit.adminPass
        },
        mode:configAtInit.socketAdmin
    })
}



let usingFallbackPort = false;

let connconsole = false;

let players = []

let mode = ['default'];

const modes = {
    "None": "default",
    "Point Capture": "pc",
    "King of the Hill": "koth",
    "Grow": "grow",
    "Shrink": "shrink",
    "One Hit": "one",
    "Race":"race",
    "Phantom":"phase",
    'Poison':"poison",
    "Bomb":"bomb",
    "Invert":"invert",
}

if(!fs.existsSync(`${appPath}/config.json`)) fs.writeFileSync(`${appPath}/config.json`, JSON.stringify({ speed: 2, port: 3000, jumpForce:8, lives:3 }, null, 2));

console.log(appPath)

let lockedGame = false;

let playingOnThis = false

const time = Date.now();

const id = electron.powerSaveBlocker.start('prevent-display-sleep');

electron.app.on("before-quit", () => {
    electron.powerSaveBlocker.stop(id);
    if(CHANGED_SAVE_TYPE && fs.existsSync(`${appPath}/stage.json`)) StageManager.removeStage();
})

const validateVersion = (requiredVersion) => {
    console.log('validating version');
    if(!requiredVersion) return console.log('No required version');
    console.log('Required version:', requiredVersion);
    if(!semver.lte(requiredVersion, require('./package.json').version)) {
        electron.dialog.showErrorBox('Error', 'This stage requires a newer version of the app. You can still play the stage, but it may not work as expected.');
    }else{
        console.log('Version is valid');
    }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

electron.app.on('ready', async () => {

    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Update Available',
            message: 'A new update is available. Downloading now...',
        });
    });

    autoUpdater.on('update-downloaded', () => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Update Ready',
            message: 'Update downloaded. The application will restart to apply the update.',
        }).then(() => {
            autoUpdater.quitAndInstall();
        });
    });

    autoUpdater.on('error', (error) => {
        dialog.showErrorBox('Update Error', error == null ? 'Unknown error' : error.toString());
    });

    let { bg_music, hit_sound, port, speed, fallbackPort } = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
    if(bg_music && !fs.existsSync(bg_music)) electron.dialog.showErrorBox('Error', 'Background music file not found. Please check the path in the settings and restart the app.');
    if(hit_sound && !fs.existsSync(hit_sound)) electron.dialog.showErrorBox('Error', 'Hit sound file not found. Please check the path in the settings and restart the app.');

    electron.app.setName("Sumo Shapes")

    const SAVE_IN = configAtInit.storeIn ? configAtInit.storeIn : 'mem';

    if(!process.argv.includes('--ni')){
    require('dns').lookup('google.com', async (err) => { 
        if (err && err.code == "ENOTFOUND") {
            console.log('No internet connection');
            electron.dialog.showErrorBox('Error', 'No internet connection. Please connect to the internet and restart the app.');
            return electron.app.quit()
        }
    })
}

const win = new electron.BrowserWindow({
    width:  configAtInit.windowWidth || electron.screen.getPrimaryDisplay().workAreaSize.width,
    height: configAtInit.windothHeight || electron.screen.getPrimaryDisplay().workAreaSize.height,
    x: configAtInit.windowX || 0,
    y: configAtInit.windowY || 0,
    resizable:true,
    webPreferences: {
preload: __dirname + '/preload.js'
    },
    titleBarStyle: configAtInit.titlebarStyle ? configAtInit.titlebarStyle : 'hiddenInset',
});

win.webContents.setUserAgent('Sumo Shapes Client v' + require('./package.json').version);

if(process.argv.includes('--dev')) win.webContents.openDevTools();

let client = new (require('discord-rpc-revamp').Client)();
client.connect({ clientId: '1243375660991516756' }).catch(console.error);

const RPC_ACTION = (RPC_OVERRIDE) => {
    if(JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8')).disableRPC) return;
    const type = win.webContents.getURL().split('/').pop();
    let string = RPC_OVERRIDE ?? ''
    if(!RPC_OVERRIDE){
    switch(type){
        case 'mainmenu.html':
            string = 'In the main menu';
            break;
        case 'builder.html':
            string = 'Building a custom stage';
            break;
        case 'start_local.html':
            string = 'Finding a stage';
            break;
           case 'settings.html':
            string = 'Configuring the game';
            break;
        case 'startg.html':
            string = 'About to start a game';
            break;
            case "credits.html":
            string = 'Viewing the credits';
            break;
        default:
            string = `Hosting a ${players.length} player game`;
            break;
    }
}
    client.setActivity({
        details: string,
        startTimestamp: time,
        largeImageKey: 'shapes',
    }).then(_ => console.log(`Set RPC  to ${string}`)).catch(console.error);
}

client.on('ready', _ => {
    if(JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8')).disableRPC) return;
    RPC_ACTION('In the main menu');
});

electron.app.setAboutPanelOptions({
    applicationName: "Sumo Shapes",
    applicationVersion: require('./package.json').version,
    version: require('./package.json').version,
    authors: ["CoolStone Technologies"],
    copyright: "© 2024 CoolStone Technologies",
    website: "https://coolstone.dev",
    credits: "View credits in Settings",
    iconPath:`${__dirname}/build/icon.png`
})

let controllerW

const menu = electron.Menu.buildFromTemplate([
    {
      label:"App",
      submenu:[
        {
           role:"about",
        },
        { type:"separator" },
        {
            role: 'quit',
            label: 'Quit'
        }
      ]  
    },
    {
        label:"Window",
        submenu:[
            {
                label: 'Minimize',
                role: 'minimize'
            },
            {
                label: 'Close',
                role: 'close'
            },
            {
                label:"Hide",
                role: 'hide'
            },
        {
            role: "togglefullscreen",
        }
        ]
    },
    {
        label: 'Game',
        submenu: [
            {
                type:"checkbox",
                checked:lockedGame,
                accelerator: 'CmdOrCtrl+L',
                label:"Lock Game",
                click: () => {
                    lockedGame = !lockedGame;
                    io.emit('lock', lockedGame);
                    console.log('Game locked:', lockedGame);
                }
            },
            {
                type:"separator"
            },
            {
                label: 'Show IP',
                accelerator: 'CmdOrCtrl+I',
                click: () => {
                    electron.dialog.showMessageBox(win, {
                        type: 'info',
                        title: 'IP Address',
                        message: `Your IP Address is ${port == 80 ? address : address + ':' + usingFallbackPort ? fallbackPort : port}`
                    });
                }
            },
            {
                type: 'separator'
            },
            {
                label:"Restart",
                role: 'reload',
            },
            {
                type:"separator"
            },
            {
                label:"Play on this Device",
                accelerator: 'CmdOrCtrl+P',
                click(){
                    if(playingOnThis) return electron.dialog.showErrorBox('Error', 'You are already playing on this device');
                    playingOnThis = true;
                    controllerW = new electron.BrowserWindow({
                        width: 550,
                        height: electron.screen.getPrimaryDisplay().workAreaSize.height,
                        webPreferences: {
                            preload: __dirname + '/preload.js'
                        },
                        x: electron.screen.getPrimaryDisplay().workAreaSize.width - 550,
                        y: 0
                    });
                    controllerW.webContents.setUserAgent('Sumo Shapes Client v' + require('./package.json').version);
                    controllerW.loadURL(`http://localhost:${usingFallbackPort ? fallbackPort : port}`);
                    controllerW.on('close', () => {
                        console.log('Controller closed');
                        playingOnThis = false;
                    })
                }
            }
        ]
    },
    {
        label: 'View',
        submenu:[
            {
                label:"Main Menu",
                accelerator: 'CmdOrCtrl+1',
                click: () => {
                    win.loadFile('mainmenu.html');
                }
            },

            {
                label:"Stage Select",
                accelerator: 'CmdOrCtrl+2',
                click: () => {
                    win.loadFile('start_local.html');
                }
            },
            {
                label:"Lobby",
                accelerator: 'CmdOrCtrl+3',
                click: () => {
                    win.loadFile('startg.html');
                }
            },
            {
                type:"separator"
            },
            {
                label:"Game View",
                accelerator: 'CmdOrCtrl+4',
                click: () => {
                    if(win.webContents.getURL().endsWith('g')) return;
                    if(players.length == 0 && !process.argv.includes('--dev')) return electron.dialog.showErrorBox('No Players', 'You must have at least one player to start the game');
                    win.loadURL(`http://localhost:${usingFallbackPort ? fallbackPort : port}/g`);
                }
            },
            {
                type:"separator"
            },
            {
                label:"Stage Builder",
                accelerator: 'CmdOrCtrl+5',
                click: () => {
                    win.loadFile('builder.html');
                }
            },
            {
                type:"separator"
            },
            {
                label: 'Settings',
                accelerator: 'CmdOrCtrl+6',
                click: () => {
                    win.loadFile('settings.html');
                }
            }
        ]
    },
    {
        label:"Text",
        submenu:[
            {
               role:"copy"
            },
            {
                role:"paste"
            }
        ]
    }
]);

electron.ipcMain.on('exitController', () => { console.log("Exited controller"); playingOnThis = false; controllerW.close() });


electron.Menu.setApplicationMenu(menu);

win.webContents.on("context-menu", (e, p) => {
    e.preventDefault();
    menu.popup()
})

win.loadFile('mainmenu.html');

win.on('close', () => {
const settings = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
if(settings.rememberSize) fs.writeFileSync(`${appPath}/config.json`, JSON.stringify({ ...settings, windowWidth: win.getSize()[0], windowHeight: win.getSize()[1] }, null, 2));
if(settings.rememberPos) fs.writeFileSync(`${appPath}/config.json`, JSON.stringify({ ...settings, windowX: win.getPosition()[0], windowY: win.getPosition()[1] }, null, 2));
})

electron.ipcMain.on('resetWinSize', () => {
    let config = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
    delete config.windowWidth;
    delete config.windowHeight;
    fs.writeFileSync(`${appPath}/config.json`, JSON.stringify(config, null, 2));
    win.setSize(electron.screen.getPrimaryDisplay().workAreaSize.width, electron.screen.getPrimaryDisplay().workAreaSize.height);
    win.setPosition(electron.screen.getPrimaryDisplay().workAreaSize.width / 2 - win.getSize()[0] / 2, electron.screen.getPrimaryDisplay().workAreaSize.height / 2 - win.getSize()[1] / 2);
})

electron.ipcMain.on('getIP', (event) => {
    event.returnValue = {
        ip: address,
        port: usingFallbackPort ? fallbackPort : port,
        v: require('./package.json').version
    }
    })

electron.ipcMain.on('hasPlayers', (event) => {
    event.returnValue = players.length > 0;
})

electron.ipcMain.on('openGame', () => {
    if(players.length == 0 && !process.argv.includes('--dev')) return electron.dialog.showErrorBox('No Players', 'You must have at least one player to start the game');
    win.loadURL(`http://localhost:${usingFallbackPort ? fallbackPort : port}/g`);
    })

electron.ipcMain.on('playDefault', () => {
    StageManager.removeStage();
    win.loadFile('startg.html');
})

io.on('connection', (socket) => {
    if(socket.handshake.headers.type == 'game'){
        console.log('Game connected');
    setTimeout(() => {
        io.emit('players', players);
    }, 1500);
    }else if(socket.handshake.headers.type == 'console'){
        if(socket.handshake.headers.user != configAtInit.adminUser || !bcrypt.compareSync(socket.handshake.headers.pass, configAtInit.adminPass)) return socket.emit('console_error', 'ERR_INVALID_CREDENTIALS');
        console.log('Console connected');
        connconsole = true;
        socket.on('console', (data) => {
            console.log('[CLIENT]', data);
        })
    }else{
        console.log('Controller connected');
    }
    socket.on('join', (data) => {
        if(lockedGame) return socket.emit('error', 'The game is locked')
        const player = {
            id: socket.id,
            photo:data.image,
            color: data.color || `#${ Math.floor(Math.random()*16777215).toString(16)}`,
            name: data.name,
            shape: data.shape
        }
        players.push(player);
        io.emit('playerConnected', player)
        io.emit('players', players);
            win.webContents.send('newPlayer', player);
            if(!win.webContents.getURL().endsWith('mainmenu.html')) RPC_ACTION();
    })

    socket.on('disconnect', () => {
        if(!players.find(p => p.id == socket.id)) return;
            io.emit('playerDisconnected', socket.id);
            players = players.filter(p => p.id != socket.id);
            console.log(socket.handshake.headers.type);
            if(socket.handshake.headers.type == 'console') connconsole = false;
            try{
            win.webContents.send('playerDisconnected', socket.id);
            io.emit('players', players);
            RPC_ACTION()
            console.log('Player disconnected', socket.id);
            }catch(e){
                console.log(e);
            }
    });

    socket.on('move', (data) => {
        let res = { id: socket.id, direction:data, speed };
         res.id = socket.id;
        io.emit('move', res);
    })

    })
    electron.ipcMain.on('getSettings', (event) => {
        event.returnValue = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
    })

   const license = expressLicense({
    appName: 'Sumo Shapes',
    additionalDeps:[
        {
            name:"Google Material Icons",
            licensePath:"https://github.com/google/material-design-icons/blob/master/LICENSE"
        },
        {
            name:"Matter.js",
            licensePath:"https://github.com/liabru/matter-js/blob/master/LICENSE"
        }
    ],
    additionalHtml:`<style> @media(prefers-color-scheme:dark){ body{ background-color:#000; color:#fff; }  a{ color:#fff; } } </style>`
   })

   app.get('/licenses/:scope?/:package?', license)

    electron.ipcMain.on('openLicenses', () => {
        electron.shell.openExternal(`http://localhost:${usingFallbackPort ? fallbackPort : port}/licenses`);
    })

    electron.ipcMain.on('saveSettings', async (event, data) => {
        let settings = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
        const changedPort = data.port != settings.port;
        const changedConsole = data.console != `${settings.console}`;
        const changedSpeed = data.speed != settings.speed;
        const changedTitleBar = data.titlebarStyle != settings.titlebarStyle;
        const changedSocketioAdmin = data.socketAdmin != settings.socketAdmin;
        const changedAdminUser = data.adminUser != settings.adminUser;
        CHANGED_SAVE_TYPE = data.storeIn != settings.storeIn;
    
        console.log('New settings', data);

        let changedCount = 0;
    
        Object.keys(data).forEach((key) => {
            if (String(data[key]).length < 0) return console.log('No data to save for ' + key);
            if (key == 'adminPass') data[key] = bcrypt.hashSync(data[key], 10);
            if (data[key] == 'true') data[key] = true;
            if (data[key] == 'false') data[key] = false;
            if (parseInt(data[key])) data[key] = parseInt(data[key]);
            settings[key] = data[key];
            if (settings[key] != data[key]) changedCount++;
        });

        if (settings.disableRPC == true) {
            client.clearActivity().then(_ => console.log('cleared activity')).catch(console.error);
        } else {
            setTimeout(() => {
                RPC_ACTION();
            }, 2000);
        }
    
        fs.writeFileSync(`${appPath}/config.json`, JSON.stringify(settings, null, 2));
    
        if (changedPort || changedConsole || changedSpeed || changedTitleBar || changedSocketioAdmin || changedAdminUser || CHANGED_SAVE_TYPE) {
            const changed = []
            if (changedPort) changed.push('port');
            if (changedConsole) changed.push('console');
            if (changedSpeed) changed.push('speed');
            if (changedTitleBar) changed.push('title bar style');
            if (changedSocketioAdmin) changed.push('Socket.IO Admin UI');
            if (changedAdminUser) changed.push('admin username');
            if (CHANGED_SAVE_TYPE) changed.push('stage storage');
            const d = await electron.dialog.showMessageBox(win, {
                type: 'info',
                message: `You have changed ${changed.join(' ')} settings, which requires a restart.`,
                buttons: ['Restart', 'Later']
            });
            if (d.response == 0) {
                electron.app.relaunch();
                electron.app.quit();
            }
        } else {
            new electron.Notification({ title: 'Settings saved', body:`Your settings have been saved` }).show();
        }
    
        win.loadFile('mainmenu.html');
    });
    

    electron.ipcMain.on('openSettings', () => {
        win.loadFile('settings.html');
    })

    electron.ipcMain.on('reload', () => {
        console.log('Reloading all clients');
       io.emit('reload');
    })


    electron.ipcMain.on("setModes", (event, m) => {
        try{
        mode = m;
        }catch(e){
            console.log(e);
            event.returnValue = 'Invalid mode';
        }
    })

    electron.ipcMain.on('getSelectedModes', (event) => { 
        event.returnValue = mode;
    })

    electron.ipcMain.on('getModeDisplay', (event) => { 
        console.log('Mode requested', mode);
        event.returnValue = Object.keys(modes)[Object.values(modes).findIndex(_m => _m == mode)] || Object.keys(modes)[0];
    })

    electron.ipcMain.on('getModes', (event) => {
        event.returnValue = modes;
    })

    electron.ipcMain.on('playAgain', () => {
    console.log('Playing again');
    const origLock = lockedGame;
    lockedGame = false;
    win.reload();
    setTimeout(() => {
        lockedGame = origLock;
    }, 1500);
    })


    app.get('/signin', (req, res) => {
        res.sendFile(__dirname + '/signin.html');
    })

    app.get('/signup', (req, res) => {
        res.sendFile(__dirname + '/signup.html');
    })

    app.get('/settings', (req, res) => {
        res.sendFile(__dirname + '/settings2.html');
    })
    
app.get('/g', (req, res) => {
    let override = StageManager.getStage() || {};
    if(players.length == 0 && !process.argv.includes('--dev')) return res.status(400).send('No players connected');
    if(!req.headers['user-agent'].includes('Sumo Shapes') && !req?.headers.cookie?.includes('bypass')) return res.status(403).send('For the best experience, please use the Sumo Shapes app, or <a href="#" onclick="document.cookie=\'bypass=true;expires=' + new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toUTCString() + '\';location.reload()">click here</a> to continue');
    let { speed, allowFlight, jumpForce, lives, npcCount, bg_type, bg_color, bg_img, platform_bg, bg_vol, hit_vol, bg_music, hit_sound, platformWidth, playerSize, powerupFreq, powerupDur, speedBoost, jumpBoost, regainLife, platformFreq, firstTo, friction, frictionAir, restitution, blurPX, randomPlatforms, invincible, phantomOpacity, phantomDur, explodeMin, explodeMax, kbAdd } = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
    if(isNaN(speed)) speed = 2;
    if(isNaN(jumpForce)) jumpForce = 8;
    if(isNaN(lives)) lives = 3;
    if(isNaN(bg_vol)) bg_vol = 0.5;
    if(isNaN(hit_vol)) hit_vol = 0.5;
    if(isNaN(playerSize)) playerSize = 50;
    if(isNaN(powerupFreq)) powerupFreq = 10;
    if(isNaN(powerupDur)) powerupDur = 10;
    if(isNaN(speedBoost)) speedBoost = 2;
    if(isNaN(jumpBoost)) jumpBoost = 2;
    if(isNaN(platformFreq)) platformFreq = 5;
    if(isNaN(firstTo)) firstTo = 10;
    if(isNaN(friction)) friction = 0.5;
    if(isNaN(frictionAir)) frictionAir = 0.02;
    if(isNaN(restitution)) restitution = 0.5;
    if(isNaN(blurPX)) blurPX = 10;
    if(isNaN(phantomOpacity)) phantomOpacity = 0.4;
    if(isNaN(explodeMin)) explodeMin = 20;
    if(isNaN(explodeMax)) explodeMax = 30;
    if(isNaN(phantomDur)) phantomDur = 20;
    if(isNaN(kbAdd)) kbAdd = 0.05;
    if(isNaN(randomPlatforms)) randomPlatforms = 2;
    if(!bg_type) bg_type = 'color';
    if(!bg_color) bg_color = '#87CEEB'; 
    if(!bg_img) bg_type = 'color';
    if(!platform_bg) platform_bg = '#000000';
    if(!platformWidth) platformWidth = "window"
    let file = fs.readFileSync(__dirname + '/index.html', 'utf8');
    if(StageManager.stageExists()) {
        console.log('Playing custom stage');
        file = file.split("'SPEED'").join(override.speed ?? speed);
        file = file.split("'JUMP_FORCE'").join(override.jumpForce ?? jumpForce);
        file = file.split("'LIVES'").join(isNaN(override.lives) ? lives : override.lives);
        file = file.split("'BG'").join(override.backgroundType == 'color' ? override.backgroundColor : `url("${override.backgroundImage}")`);
        file = file.split("'BG_COLOR'").join(override.backgroundColor ?? bg_color);
        file = file.split("'PLATFORMS'").join(JSON.stringify(override.platforms));
        file = file.split("'BG_MUSIC'").join(override.bgMusic ?? bg_music);
        file = file.split("'HIT_SOUND'").join(override.hitSound ?? hit_sound);
        file = file.split("'BG_VOL'").join(bg_vol);
        file = file.split("'HIT_VOL'").join(hit_vol);
        file = file.split("'ALLOW_FLIGHT'").join(allowFlight);
        file = file.split("'PLATFORM_BG'").join(platform_bg);
        file = file.split("'RANDOM_PLATFORMS'").join(randomPlatforms == 1 || randomPlatforms == 3 ? 'true' : 'false');
        file = file.split("'PLATFORM_WIDTH'").join((override.platformWidth ?? platformWidth) == 'window' || (override.platformWidth ?? platformWidth) == 'pulse' ? 'window.innerWidth' : (override.platformWidth ?? platformWidth));
        file = file.split("'PLAYER_SIZE'").join(isNaN(override.playerSize) ? playerSize : override.playerSize);
        file = file.split('POWERUP_DURATION').join(override.powerupDur ?? powerupDur);
        file = file.split('POWERUP_FREQ').join(override.powerupFreq ?? powerupFreq);
        file = file.split('SPEED_BOOST').join(override.speedBoost ?? speedBoost);
        file = file.split('JUMP_BOOST').join(override.jumpBoost ?? jumpBoost);
        file = file.split('REGAIN_LIFE').join(override.regainLife ?? regainLife);
        file = file.split('PLATFORM_FREQ').join(override.platformFreq ?? platformFreq);
        file = file.split('BG_COLOR').join(override.backgroundColor ?? bg_color);
        file = file.split("'NPCS'").join(isNaN(override.npcCount) ? npcCount : override.npcCount);
        file = file.split("GAMEMODE").join(override.gamemode ?? mode ?? 'default');
        file = file.split("'FIRST_TO'").join(override.firstTo ?? firstTo);
        file = file.split("'FRICTION'").join(override.friction ?? friction);
        file = file.split("'FRICTION_AIR'").join(override.frictionAir ?? frictionAir);
        file = file.split("'RESTITUTION'").join(override.restitution ?? restitution);
        file = file.split("'INVINCIBLE'").join(override.invincible ?? invincible);
        file = file.split("'BLUR_PX'").join(blurPX);
        file = file.split("'PHANTOM_OPACITY'").join(override.phantomOpacity ?? phantomOpacity)
        file = file.split("'EX_MIN'").join(explodeMin);
        file = file.split("'EX_MAX'").join(explodeMax);
        file = file.split("'PHANTOM_DUR'").join(override.phantomDur ?? phantomDur);
        file = file.split("'KB_ADD'").join(kbAdd);
        if(override.platformWidth == 'pulse') {
            file = file.split('PULSE_PLATFORM').join('true');
        }else{
            file = file.split('PULSE_PLATFORM').join('false');
        }
    }else{
    console.log('Playing default stage');
    file = file.split("'SPEED'").join(speed).split("'JUMP_FORCE'").join(jumpForce).split("'LIVES'").join(lives).split("'BG'").join(bg_type == 'color' ? bg_color : `url("${bg_img}")`).split("'PLATFORM_BG'").join(platform_bg).split("'BG_MUSIC'").join(bg_music).split("'HIT_SOUND'").join(hit_sound).split("'BG_VOL'").join(bg_vol).split("'HIT_VOL'").join(hit_vol).split("'ALLOW_FLIGHT'").join(allowFlight).split("'IS_CUSTOM'").join('false').split("'PLATFORM_WIDTH'").join(platformWidth == 'window' ? 'window.innerWidth' : platformWidth == 'pulse' ? 'window.innerWidth' : platformWidth).split("'PLAYER_SIZE'").join(playerSize).split('POWERUP_DURATION').join(powerupDur).split('POWERUP_FREQ').join(powerupFreq).split('SPEED_BOOST').join(speedBoost).split('JUMP_BOOST').join(jumpBoost).split('REGAIN_LIFE').join(regainLife).split('PLATFORM_FREQ').join(platformFreq).split('BG_COLOR').join(bg_color).split("'NPCS'").join(npcCount)
    .split('GAMEMODE').join(JSON.stringify(mode) || '["default"]')
    .split("'FIRST_TO'").join(firstTo)
    .split("'FRICTION'").join(friction)
    .split("'FRICTION_AIR'").join(frictionAir)
    .split("'RESTITUTION'").join(restitution)
    .split("'BLUR_PX'").join(blurPX)
    .split("'KB_ADD'").join(kbAdd)
    .split("'INVINCIBLE'").join(invincible)
    .split("'PHANTOM_OPACITY'").join(phantomOpacity)
    .split("'EX_MIN'").join(explodeMin)
    .split("'EX_MAX'").join(explodeMax)
    .split("'PHANTOM_DUR'").join(phantomDur)
    .split("'BG_COLOR'").join(bg_color)
    .split("'RANDOM_PLATFORMS'").join(randomPlatforms == 1 || randomPlatforms == 2 ? 'true' : 'false')
    .split("'PLATFORMS'").join('[]');
    if(platformWidth == 'pulse') {
        file = file.split('PULSE_PLATFORM').join('true');
    }else{
        file = file.split('PULSE_PLATFORM').join('false');
    }
    }
    StageManager.setStage(override);
    file = file.replace("'LOCKED'", lockedGame);
   res.send(file);
 })

 electron.ipcMain.on('openFile', (event) => {
    electron.shell.openPath(`${appPath}/config.json`);
})

electron.ipcMain.on('players', (event) => {
    event.returnValue = players;
})

electron.ipcMain.emit('players', players);

electron.ipcMain.on('removeMusic', () => {
    let s = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
    s.bg_music = ''
    fs.writeFileSync(`${appPath}/config.json`, JSON.stringify(s, null, 2));
    new electron.Notification({ title: 'Background music removed', body: 'Background music has been removed.' }).show();
    electron.dialog.showMessageBox(win, { type: 'info', message: 'Background music removed.' });
})

electron.ipcMain.on('removeSound', () => {
    let s = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
    s.hit_sound = ''
    fs.writeFileSync(`${appPath}/config.json`, JSON.stringify(s, null, 2));
    new electron.Notification({ title: 'Hit sound removed', body: 'Hit sound has been removed.', actions:[ { text:"Close" } ] }).show();
    electron.dialog.showMessageBox(win, { type: 'info', message: 'Hit sound removed.' });
})

electron.ipcMain.on('openStage', (e, stageOwner, stageName) => {
    const options = [ 'View Preview', 'View Source', 'Show QR Code', 'Open on GitHub', 'Cancel'];
    electron.dialog.showMessageBox(win, {
        type: 'info',
        message: 'What would you like to do with ' + stageName + '?',
        buttons: options
    }).then(async res => {
        if (res.response == 0) {
            const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
            const b = new electron.BrowserWindow({ width, height })
            b.loadURL(`http://localhost:${usingFallbackPort ? fallbackPort : port}/preview?stage=${stageOwner}/${stageName}`)
        } else if (res.response == 1) {
            new electron.BrowserWindow({ width: 700, height: 500, resizable:false }).loadURL(`http://localhost:${usingFallbackPort ? fallbackPort : port}/source?stage=${stageOwner}/${stageName}`);
        }else if(res.response == 2){
            win.webContents.send('qr', `https://github.com/${stageOwner}/${stageName}`);
        }else if(res.response == 3){
            electron.shell.openExternal(`https://github.com/${stageOwner}/${stageName}`);
        }
        })
})


app.get('/source', async (req, res) => {
    if(req.query.raw == 'true'){
        const u = req.query.stage.split('/')[0];
        const r = req.query.stage.split('/')[1];
        const response = await fetch(`https://raw.githubusercontent.com/${u}/${r}/main/index.json`);
        const data = await response.json();
        return res.json(data);
    }
    res.sendFile(__dirname + '/source.html');
})

electron.ipcMain.on('openMode', () => {
let oldmodes = mode
const b = new electron.BrowserWindow({ width: 700, height: 500, webPreferences: { preload: __dirname + '/preload.js' }, titleBarStyle: 'hidden', resizable:false, minimizable:false, alwaysOnTop:true });
b.loadFile('gmode.html');
b.on('close', () => {   
    if(mode.length <= 0) mode = ['default'];
    if(mode.length > 1 && mode.includes('default')) mode = mode.filter(m => m != 'default');
    if(oldmodes != mode){
        let mutators = ''
        for(let m of mode){
            mutators += Object.keys(modes)[Object.values(modes).findIndex(_m => _m == m)];
            if(mode.indexOf(m) != mode.length - 1) mutators += ', '
        }
        new electron.Notification({ title: 'Mutators Set', body:mutators }).show();
    }
})
})

electron.ipcMain.on('openStageBuilder', () => {
    win.loadFile('builder.html');
})

electron.ipcMain.on('menu', () => {
    win.loadFile('mainmenu.html');
})

app.get('/qrcodejs', (req, res) => {
    res.sendFile(require('path').join(require.resolve('qrcodejs'), '../qrcode.min.js'));
})

electron.ipcMain.on('save', (event, data) => {
    data.updated = Date.now();
    electron.dialog.showSaveDialog(win, {
        title: 'Save Game Data',
        defaultPath: `sumo-shapes-stage-${Date.now()}.json`,
        filters: [
            { name: 'JSON', extensions: ['json'] }
        ]
    }).then(async (file) => {
        if(file.canceled) return;
        console.log('Stage saved to', file.filePath);
        fs.writeFileSync(file.filePath
            , JSON.stringify(data, null, 2));
            const notification = new electron.Notification({
                title: 'Stage saved',
                body: 'Your stage has been saved.',
                actions: [
                  { text: 'Open', type: 'button' },
                  { text: 'Show in Folder', type: 'button' }
                ],
                closeButtonText: 'Close'
              });
            
              notification.on('action', (event, index) => {
                if (index === 0) {
                  electron.shell.openPath(file.filePath);
                } else if (index === 1) {
                  electron.shell.showItemInFolder(file.filePath);
                }
              });
            
              notification.show();
    })
})

electron.ipcMain.on('playCustom', async () => {
    const filepath = await electron.dialog.showOpenDialog(win, { title: 'Select a stage file', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!filepath.canceled && filepath.filePaths.length > 0) {
        const file = JSON.parse(fs.readFileSync(filepath.filePaths[0], 'utf8'));
        StageManager.setStage(file);
        validateVersion(file.requiredVersion);
        setTimeout(() => {
            win.loadFile('startg.html');
        }, 1000);
        io.emit('reload');
    } else {
        console.log('No file selected or dialog was canceled'); // Log if no file was selected
    }
});

electron.ipcMain.on('hasSavedStage', (e) => {
   e.returnValue = StageManager.stageExists();
})

electron.ipcMain.on('findStageLocal', async () => {
    type = 'local';
    win.loadFile('start_local.html');
})

electron.ipcMain.on('publishStage', async (event) => {
    console.log('Showing publish page');
    new electron.BrowserWindow({
        width:electron.screen.getPrimaryDisplay().workAreaSize.width/1.5,
        height:electron.screen.getPrimaryDisplay().workAreaSize.height/1.1,
       webPreferences: {
        preload: __dirname + '/preload.js'
       }
    }).loadFile(__dirname + '/publish.html');
})

electron.ipcMain.on('quit', () => {
    electron.app.quit();
})

 app.get('/s', (req, res) => {
    res.sendFile(__dirname + '/stats.html');
 })
 
 app.get('/bgmusic', (req, res) => {
    console.log('Background music requested');
    let bgM = fs.realpathSync(JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8')).bg_music);
    console.log('Background music file:', bgM);
    if(!fs.existsSync(bgM)) return res.status(404).send('Background music file not found')
    res.sendFile(bgM);
 })

 app.get('/exitcontroller', (req, res) => {
    res.sendFile(__dirname + '/exit.html');
    })

 app.get('/hitsound', (req, res) => { 
    let hitS = fs.realpathSync(JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8')).hit_sound);
    if(!fs.existsSync(hitS)) return res.status(404).send('Hit sound file not found')
    res.sendFile(hitS);
    })


app.get('/old', (req, res) => {
    res.sendFile(__dirname + '/controllerold.html');
})

app.get('/controller.js', (req, res) => {
    res.sendFile(__dirname + '/controller.js');
})

    app.get('/movement.js', (req, res) => {
        res.sendFile(__dirname + '/movement.js');
    })

    app.get('/console', (req, res) => {
        res.sendFile(__dirname + '/console.html');
    })

    if(socketAdmin()){
    app.get('/admin', (req, res) => {
        res.sendFile(require.resolve('@socket.io/admin-ui/ui/dist/index.html'));
    });

    app.get('/js/chunk-vendors.934c03ff.js', (req, res) => {
        res.sendFile(require.resolve('@socket.io/admin-ui/ui/dist/js/chunk-vendors.934c03ff.js'));
    })

    app.get('/js/app.0d7d7845.js', (req, res) => {
        res.sendFile(require.resolve('@socket.io/admin-ui/ui/dist/js/app.0d7d7845.js'));
    })

    app.get('/css/app.0d7d7845.css', (req, res) => {
        res.sendFile(require.resolve('@socket.io/admin-ui/ui/dist/css/app.0d7d7845.css'));
    })

    app.get('/css/chunk-vendors.9f55d012.css', (req, res) => {
        res.sendFile(require.resolve('@socket.io/admin-ui/ui/dist/css/chunk-vendors.9f55d012.css'));
    })
}

app.get('/callback', (req, res) => {
    res.sendFile(__dirname + '/publish.html');
})

    app.get('/*', (req, res) => {
        const file = fs.readFileSync(__dirname + '/controller.html', 'utf8');
        res.send(file.replace("'SPEED'", speed));
    })

        win.webContents.on('did-navigate', () => { 
            RPC_ACTION()
            if(win.webContents.getURL().endsWith('g')) {
                win.setResizable(false);
            }else{
                win.setResizable(true)
            }
            console.log('Navigated to', win.webContents.getURL().split('/').pop())
         });

electron.ipcMain.on('playStage', async (event, u, r) => {
    console.log('playStage: ', u, r);
    try {
        const options = {
            hostname: 'raw.githubusercontent.com',
            path: `/${u}/${r}/main/index.json`,
            method: 'GET'
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    StageManager.setStage(JSON.parse(data));
                    validateVersion(StageManager.getStage().requiredVersion);
                    win.loadFile('startg.html');
                } catch (e) {
                    electron.dialog.showErrorBox('Error', 'Could not parse index.json in the repository.');
                }
            });
        });

        req.on('error', (e) => {
            electron.dialog.showErrorBox('Error', 'Could not find index.json in the repository. Ask the creator to make sure there is a file named index.json in the main branch of the repository.');
        });

        req.end();
    } catch (e) {
        electron.dialog.showErrorBox('Error', 'An error occurred while fetching index.json from the repository.');
    }
});

electron.ipcMain.on('credits', () => {
    win.loadFile('credits.html');
})


electron.ipcMain.on('playStageObj', async (event, obj) => {
    console.log('playStageObj: ', obj);
    StageManager.setStage(obj);
    validateVersion(StageManager.getStage().requiredVersion);
    win.loadFile('startg.html');
})

electron.ipcMain.on('clearCustomStage', () => {
    console.log('Custom stage cleared');
    StageManager.removeStage();
    electron.dialog.showMessageBox(win, { type: 'info', message: 'Custom stage cleared.' });
})

electron.ipcMain.on('devTools', () => {
    win.webContents.isDevToolsOpened() ? win.webContents.closeDevTools() : win.webContents.openDevTools();
})

electron.ipcMain.on('openURL', (e, url) => {
    console.log('Opening', url);
    electron.shell.openExternal(url);
})
    
server.listen(port, () => {
    console.log(`Server started on port ${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        usingFallbackPort = true;
        const fallbackPort = require(`${appPath}/config.json`).fallbackPort || 3001;
        if(!process.argv.includes('--dev')) electron.dialog.showErrorBox('Error', 'Port in use. Starting on fallback port :' + fallbackPort);
        console.log('Port in use. Starting on fallback port');
        server.listen(fallbackPort, () => {
            console.log(`Server started on fallback port ${fallbackPort}`);
        });
    } else {
        console.error(err);
    }
});

electron.ipcMain.on('socketAdmin', (event, mode) => {
    if(!socketAdmin()) return electron.dialog.showErrorBox('Error', 'Admin UI is not enabled');
    new electron.BrowserWindow({ width: 800, height: 600 }).loadURL(`http://localhost:${usingFallbackPort ? fallbackPort : port}/admin`);
})

electron.ipcMain.on('openConsole', () => {
    if(!configAtInit.console) return electron.dialog.showErrorBox('Error', 'Console is not enabled');
    new electron.BrowserWindow({ width: 800, height: 600 }).loadURL(`http://localhost:${usingFallbackPort ? fallbackPort : port}/console`);
 })

 electron.ipcMain.on('homedir', (event) => {
    event.returnValue = require('os').homedir();
})

})


app.get('/preview', (req, res) => {
    res.sendFile(__dirname + '/preview.html');
})

electron.ipcMain.on('forkRepo', () => {
electron.shell.openExternal('https://github.com/sumoshapes/sumoshapes.github.io/fork');
})

app.get('/socket.io.js', (req, res) => {
    res.sendFile(__dirname +'/node_modules/socket.io-client/dist/socket.io.min.js');
})

if(configAtInit.console == true){
    console.log = function(...args) {
        const processedArgs = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (error) {
                    return arg; 
                }
            }
            return arg;
        }).join(' ');
        if(connconsole) io.emit('console', processedArgs);
        process.stdout.write(processedArgs + '\n');
    };    
    if(electron.app.isPackaged){
    console.error = function(...args) {
        if(connconsole) io.emit('console_error', args.join(' '));
    }
}
}
