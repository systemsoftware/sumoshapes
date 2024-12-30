const fs = require('fs');

const TYPE = JSON.parse(fs.readFileSync(require('electron').app.getPath('userData') + '/config.json')).storeIn || "mem";

const fileStorage = require('electron').app.getPath('userData') + '/stage.json';

let memoryStorage = {};

module.exports = {
  stageExists:() => {
    if(TYPE === "mem"){
      return Object.keys(memoryStorage).length !== 0;
    }else{
        if(!fs.existsSync(fileStorage)) return false;
      return Object.keys(JSON.parse(fs.readFileSync(fileStorage))).length !== 0;
    }
   },
   getStage:() => {
    if(!module.exports.stageExists()) return {};
    if(TYPE === "mem"){
      return memoryStorage;
    }else{
      return JSON.parse(fs.readFileSync(fileStorage));
    }
   },
   setStage:(stage) => {
    if(TYPE === "mem"){
     memoryStorage = stage;
    }else{
        if(typeof stage == "undefined" || stage == null) return fs.writeFileSync(fileStorage,JSON.stringify({}));
      fs.writeFileSync(fileStorage,JSON.stringify(stage));
    }
   },
   removeStage:() => {
    if(TYPE === "mem"){
      memoryStorage = {};
    }else{
        if(!fs.existsSync(fileStorage)) return;
      fs.unlinkSync(fileStorage);
    }
   }
}