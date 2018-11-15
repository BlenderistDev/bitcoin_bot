const https = require("https");
const fs = require("fs");
const Telegraf = require('telegraf');
const Telegram = require('telegraf/telegram');
const TELEGRAM_API_TOKEN = "733335360:AAEqeFvvLu5qSG7Fml6CZ5IhwobzYiVdGeg";
const telegram = new Telegram(TELEGRAM_API_TOKEN);
const bot = new Telegraf(TELEGRAM_API_TOKEN, {
	polling: true
});

//hi
var UserObject = class{
  constructor(){
    this.id = undefined;
    this.lastcommand = null;
    this.address = [];
    var tx = {hash:undefined,confirms:undefined};
    this.address.push(tx);
  }
  addAddress(address){
    this.address.push({address:address,tx:[]});
    this.lastcommand = null;
    writeJsonFile(obj);
  }
  addressSearch(address){
    var addressIsHere = false;
    obj.address.forEach((elem)=>{
      if (elem.address == address)
        addressIsHere = true;      
    })
    return addressIsHere;
  }
  request(addressIndex){
    var addrData = "";
    var addr = this.address[addressIndex].address;
    https.get("https://chain.api.btc.com/v3/address/"+ addr +"/tx", function(res){
      res.on('data', function(d){
        addrData += d.toString();       
      });
      res.on('end',function(){
         var object = JSON.parse(addrData).data;
        //console.log(object)
        for (var i=0;i<Math.min(object.total_count,object.pagesize);i++){
          if (object.list[i].balance_diff > 0 && object.list[i].confirmations < 1001){
            obj.checkTx(addressIndex,object.list[i].hash,object.list[i].confirmations,object.list[i].balance_diff)
          }
        }
      })
    }).on('error', (e) => {
      console.error(e);
    });
  }
  checkAddress(){
    for (var i=0; i < this.address.length;i++){
      new RequestObject(this.id,this.address[i].address,i);
    }
  }
  checkTx(addressIndex,hash,confirms,balance_diff){
    var txisHere = false;
    var maxConfirms = 1000;
    for (var i=0; i<this.address[addressIndex].tx.length;i++ ){
      if (this.address[addressIndex].tx[i].hash == hash){
        txisHere = true;
        if (confirms >= maxConfirms){    
          telegram.sendMessage(obj.id,"Новое подтверждение для адреса:"+this.address[addressIndex].address+"\nТранзакция: "+ hash +", количество подтверждений: "+confirms);
          this.address[addressIndex].tx = this.address[addressIndex].tx.slice(0,i).concat(this.address[addressIndex].tx.slice(i+1));
          break;
        }
        else if (this.address[addressIndex].tx[i].confirms < confirms){
          telegram.sendMessage(this.id,"Новое подтверждение для адреса:"+this.address[addressIndex].address+"\nТранзакция: "+ hash +", количество подтверждений: "+confirms);
          this.address[addressIndex].tx[i].confirms = confirms;
          break;
        }
      }
    }
    if (txisHere == false && confirms < maxConfirms ){
      this.address[addressIndex].tx.push({hash:hash,confirms:confirms})
      telegram.sendMessage(obj.id,"Новая транзакция для адреса:"+this.address[addressIndex].address+"\nТранзакция: "+ hash +", количество подтверждений: "+confirms+"\nсумма:"+balance_diff*0.00000001 +"BTC");
      txisHere = true;
    }
    if (txisHere == true)
      this.savetoFile();
  }
  savetoFile(){
    writeJsonFile(this);
  }
}

var RequestObject = class{
  constructor(id,address,addressIndex){
    this.id = id;
    this.address = address;
    this.addressIndex = addressIndex;
    if (!requestOderSearch(this)){
      var l = requestOder.push(this);
    }
  }
  request(){
    var addressIndex = this.addressIndex;
    readJsonFile("data/"+this.id+".json").then(function(obj){
      obj.request(addressIndex);
      requestOder = requestOder.slice(1);
    })
  }
  competition(obj){
    if ((this.id == obj.id) && (this.address == obj.address) && (this.addressIndex == obj.addressIndex))
      return true;
    else
      return false;
  }


}


var requestOder = [];
function requestOderSearch(obj){
  var bool = false;
  requestOder.forEach((element)=>{
    if (element.competition(obj)==true)
      bool = true;
  })
  return bool;
}


setInterval(() => {
  if (requestOder.length != 0)
    requestOder[0].request();
}, 1000*10);
function botStart(msg){
  var id = msg.from.id;
  console.log("user "+id+" starts bot");
  fs.readdir("data",function(error,data){
    if (error)
      throw error;
    if (data.includes(id+".json")==false){
        var obj = {id:id,lastcommand:null,address:[]};
        writeJsonFile(obj);
        console.log("file for user "+id+" created");
    }
    else
      console.log("file for user "+id+" found");
  })
}
function readJsonFile(file){
  return new Promise(function(success,fail){
    fs.readFile(file,function(error,data){
      if (error){
        console.log("error with reading file:"+file);
      }
      else{
        obj = JSON.parse(data);
        obj.__proto__ = new UserObject;
        success(obj);
      }
    })
  })
} 
function writeJsonFile(obj){
  console.log("write file "+obj.id)
  console.log(JSON.stringify(obj).toString())
  fs.unlink("data/"+obj.id+".json",(err)=>{
    if (err)
      console.log(err);
    fs.writeFile("data/"+obj.id+".json",JSON.stringify(obj),'utf8', function(){});
  })
  
}

bot.start(botStart);
bot.startPolling();
bot.command("addaddress",function(msg){
  var id = msg.from.id;
  readJsonFile("data/"+msg.from.id+".json").then(function(obj){
    obj.lastcommand = "addaddress"
    telegram.sendMessage(id,"Отправь мне биткоин адрес, для которого нужно отслеживать подтверждения");
    writeJsonFile(obj);
  })
  setTimeout(function(){
    readJsonFile("data/"+id+".json").then(function(obj){
      if (obj.lastcommand == "addaddress"){
        obj.lastcommand = "null"
        writeJsonFile(obj);
        telegram.sendMessage(id,"Ты так и не прислал адрес. Если решишь добавить адрес, воспользуйся командой.");
      }
    })
  },1000*60*5) 
});
bot.command("myaddress",function(msg){
  var id = msg.from.id;
  readJsonFile("data/"+msg.from.id+".json").then(function(obj){
    telegram.sendMessage(id,"Добавленные адреса:");
    obj.address.forEach((elem)=>telegram.sendMessage(id,elem.address))
  })
});
bot.on('text',function(msg){
	readJsonFile("data/"+msg.chat.id+".json").then(function(obj){
    if (obj.lastcommand == "addaddress")
      checkAddressCorrect(msg.message.text,msg.chat.id)
	})
});


function checkConfirms(){
  fs.readdir("data/",function(error,data){
    if (error)
      conlose.error(error);
    data.forEach(function(element){
    if (element){
      readJsonFile("data/"+element).then(function(data){
        checkNotificationsNeed(data);
      })
    }
    })
  })
}
setInterval(checkConfirms,1000*20);
function checkNotificationsNeed(obj){
  obj.checkAddress();
}
function checkAddressCorrect(msg,id){
  var addrData = "";
  https.get("https://blockchain.info/rawaddr/"+ msg, function(res){
    res.on('data', function(d){
      addrData += d.toString();       
    });
    res.on('end',function(){
      var correct = true;
      try{
        object = JSON.parse(addrData).data;
      }
      catch(error){
        correct = false;
        telegram.sendMessage(id,"Некорректный адрес!");
      }
      if (correct == true){
        readJsonFile("data/"+id+".json").then(function(obj){
          if (!obj.addressSearch){
            telegram.sendMessage(id,"Записал!");
            obj.addAddress(msg);
          }
          else
            telegram.sendMessage(id,"Адрес уже отслеживается!");
        })
      }
    })
  }).on('error', (e) => {
    console.error(e);
  });
  
}
