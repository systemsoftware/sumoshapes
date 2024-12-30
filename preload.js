const { contextBridge, ipcRenderer, webUtils } = require('electron')

let playerCount = 0

ipcRenderer.on('newPlayer', (event, data) => {
if(!document.getElementById('players')) return
if(document.getElementById('noPlayers')) document.getElementById('noPlayers').remove()
if(document.getElementById(data.id)) return
const newPlayerP = document.createElement('h3')
newPlayerP.textContent = data.name
newPlayerP.id = data.id
document.getElementById('players').appendChild(newPlayerP)
playerCount++
})

ipcRenderer.on('players', (event, data) => {
    if(!document.getElementById('players')) return
    if(document.getElementById('noPlayers')) document.getElementById('noPlayers').remove()
    data.forEach(player => {
        if(document.getElementById(player.id)) return
        const newPlayerP = document.createElement('p')
        newPlayerP.textContent = player.name
        newPlayerP.id = player.id
        document.getElementById('players').appendChild(newPlayerP)
        playerCount++
    })
    })

ipcRenderer.on('playerDisconnected', (event, data) => {
if(!document.getElementById('players')) return
document.getElementById('players').removeChild(document.getElementById(data))
playerCount--
if(playerCount == 0){ 
    const noPlayers = document.createElement('h3')
    noPlayers.textContent = 'No players connected'
    noPlayers.id = 'noPlayers'
    document.getElementById('players').appendChild(noPlayers)
}
})


contextBridge.exposeInMainWorld('electron', {
   getIP: () => {
       return ipcRenderer.sendSync('getIP')
   },
   openGame: () => {
       ipcRenderer.send('openGame')
   },
   playDefault: () => {
    ipcRenderer.send('playDefault')
},
   getSettings: () => {
         return ipcRenderer.sendSync('getSettings')
   },
   saveSettings: (data) => {
       ipcRenderer.send('saveSettings', data)
   },
   openSettings: () => {
       ipcRenderer.send('openSettings')
   },
   sendReload: () => {
       ipcRenderer.send('reload')
   },
   openFile: (file) => {
       ipcRenderer.send('openFile', file)
   },
   removeMusic: () => {
       ipcRenderer.send('removeMusic')
   },
   removeSound: () => {
       ipcRenderer.send('removeSound')
   },
   exitController: () => {
       ipcRenderer.send('exitController')
   },
   openStageBuilder: () => {
       ipcRenderer.send('openStageBuilder')
   },
   menu: () => {
       ipcRenderer.send('menu')
   },
   save:(data) => {
         ipcRenderer.send('save', data)
   },
   playCustom: () => {
       ipcRenderer.send('playCustom')
   },
   findStageLocal: () => {
       ipcRenderer.send('findStageLocal')
   },
    findStageOnline: (valid) => {
        if(valid == true){
        ipcRenderer.send('findStageOnline')
        }else{
            ipcRenderer.send('check')
        }
    },
   publishStage: (data) => {
         ipcRenderer.send('publishStage')
    },
    quit:() => {
        ipcRenderer.send('quit')
    },
    playAgain: () => {
        ipcRenderer.send('playAgain')
    },
    players: () => {
       return ipcRenderer.sendSync('players')
    },
    playStage: (u,r) => {
        ipcRenderer.send('playStage', u,r)
    },
    playStageObj: (data) => {
        ipcRenderer.send('playStageObj', data)
    },
    clearCustomStage: () => {
        ipcRenderer.send('clearCustomStage')
    },
    showImgs: () => {
        ipcRenderer.send('showImgs')
    },
    toggleRPC: () => {
        ipcRenderer.send('toggleRPC')
    },
    devTools: () => {
        ipcRenderer.send('devTools')
    },
    isOnline: () => {
        return false
    },
    getModes: () => {
        return ipcRenderer.sendSync('getModes')
    },
    setModes: (mode) => {
        ipcRenderer.send('setModes', mode)
    },
    getSelectedModes: () => {
        return ipcRenderer.sendSync('getSelectedModes')
    },
    openConsole: () => {
        ipcRenderer.send('openConsole')
    },
    getModeDisplay: () => {
        return ipcRenderer.sendSync('getModeDisplay')
    },
    socketAdmin: (data) => {
        ipcRenderer.send('socketAdmin', data)
    },
    credits: () => {
        ipcRenderer.send('credits')
    },
    openLicenses: () => {
        ipcRenderer.send('openLicenses')
    },
    openURL(url){
        ipcRenderer.send('openURL', url)
    },
    forkRepo: () => {
        ipcRenderer.send('forkRepo')
    },
    hasPlayers: () => {
      return ipcRenderer.sendSync('hasPlayers')
    },
    openStage:(owner, stage) => {
        ipcRenderer.send('openStage', owner, stage)
    },
    onQRRequest: (cb) => ipcRenderer.on('qr', cb),
    openMode: () => {
        ipcRenderer.send('openMode')
    },
    resetWinSize: () => {
        ipcRenderer.send('resetWinSize')
    },
    handleGamemodeChange: (cb) => ipcRenderer.on('gamemodeChange', cb),
    homedir: () => {
        return ipcRenderer.sendSync('homedir')
    },
    hasSavedStage: () => {
        return ipcRenderer.sendSync('hasSavedStage')
    },
    webUtils
    })