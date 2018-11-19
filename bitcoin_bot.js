const https = require("https");
const fs = require("fs");
const Telegram = require('node-telegram-bot-api');
const Agent = require('socks5-https-client/lib/Agent')
const TELEGRAM_API_TOKEN = "733335360:AAEqeFvvLu5qSG7Fml6CZ5IhwobzYiVdGeg";
const bot = new Telegram(TELEGRAM_API_TOKEN, {
	polling: true,
	request: {
		agentClass: Agent,
		agentOptions: {
			socksHost: 'hvkun.teletype.live',
      socksPort: 1080,
			socksUsername: 'telegram',
			socksPassword: 'telegram'
		}
	}
})

class UserObject{
  constructor(){
    this.id = undefined;
    this.lastcommand = null;
    this.maxConfirms = 2;
    this.address = [];
  }
  addAddress(address){
    this.address.push({address:address,tx:[]});
    this.lastcommand = null;
    this.savetoFile;
  }
  addressSearch(address){
    var addressIsHere = false;
    this.address.forEach((elem)=>{
      if (elem.address == address)
        addressIsHere = true;      
    })
    return addressIsHere;
  }
  request(addressIndex){
    var addrData = "";
    var addr = this.address[addressIndex].address;
    var obj = this;
    var maxConfirms = 2001;//транзакции с количеством подтверждений выше не будут рассматриваться системой.
    https.get("https://chain.api.btc.com/v3/address/"+ addr +"/tx", function(res){
      res.on('data', function(d){
        addrData += d.toString();       
      });
      res.on('end',function(){
        try{
          var object = JSON.parse(addrData).data;
          for (var i=0;i<Math.min(object.total_count,object.pagesize);i++){
            if (object.list[i].balance_diff > 0 && object.list[i].confirmations < (maxConfirms)){
              obj.checkTx(addressIndex,object.list[i].hash,object.list[i].confirmations,object.list[i].balance_diff)
            }
          }
        }catch(error){
          console.log("error with parsing request object, addrDara="+addrData+", error="+error);
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
    for (var i=0; i<this.address[addressIndex].tx.length;i++ ){
      if (this.address[addressIndex].tx[i].hash == hash){
        txisHere = true;
        if (confirms >= this.maxConfirms){    
          UserObject.sendMessage(this.id,"Новое подтверждение для адреса:"+this.address[addressIndex].address+"\nТранзакция: "+ hash +", количество подтверждений: "+confirms);
          this.address[addressIndex].tx = this.address[addressIndex].tx.slice(0,i).concat(this.address[addressIndex].tx.slice(i+1));
          break;
        }
        else if (this.address[addressIndex].tx[i].confirms < confirms){
          UserObject.sendMessage(this.id,"Новое подтверждение для адреса:"+this.address[addressIndex].address+"\nТранзакция: "+ hash +", количество подтверждений: "+confirms);
          this.address[addressIndex].tx[i].confirms = confirms;
          break;
        }
      }
    }
    if (txisHere == false && confirms < this.maxConfirms ){
      this.address[addressIndex].tx.push({hash:hash,confirms:confirms})
      UserObject.sendMessage(this.id,"Новая транзакция для адреса:"+this.address[addressIndex].address+"\nТранзакция: "+ hash +", количество подтверждений: "+confirms+"\nсумма:"+balance_diff*0.00000001 +"BTC");
      txisHere = true;
    }
    if (txisHere == true)
      this.savetoFile();
  }
  savetoFile(){
    this.writeJsonFile();
  }
  writeJsonFile(){
    console.log("write file "+this.id)
    console.log(JSON.stringify(this).toString())
    fs.unlink("data/"+this.id+".json",(err)=>{
      if (err)
        console.log(err);
      fs.writeFile("data/"+this.id+".json",JSON.stringify(this),'utf8', function(){});
    })
  }
  checkMaxConfirmsCorrect(msg){
    console.log(msg)
    if (!(/^\d+$/.test(msg))){
      UserObject.sendMessage(this.id,"Это не число!");
    }
    else if(msg>2000){
      UserObject.sendMessage(this.id,"Максимальное количество подтверждений: 2000");
    }
    else if(msg <=0){
      UserObject.sendMessage(this.id,"Максимальное количество подтверждений должно быть больше нуля");
    }
    else{
      UserObject.sendMessage(this.id,"Записал!");
      this.maxConfirms = msg;
      this.lastcommand = null;
      this.savetoFile();
    }
  } 
  checkAddressCorrect(msg){
    var addrData = "";
    var obj = this;
    https.get("https://blockchain.info/rawaddr/"+ msg, function(res){
      res.on('data', function(d){
        addrData += d.toString();       
      });
      res.on('end',function(){
        try{
          var object = JSON.parse(addrData).data;
          if (!obj.addressSearch(msg)){
            UserObject.sendMessage(obj.id,"Записал!");
            obj.addAddress(msg);
            obj.savetoFile();
          }
          else
            UserObject.sendMessage(obj.id,"Адрес уже отслеживается!");
        }
        catch(error){
          UserObject.sendMessage(obj.id,"Некорректный адрес!");
          //console.log(error);
        }
      })
    }).on('error', (e) => {
      console.error(e);
    });
    
  }  
  static readJsonFile(file){
    return new Promise(function(success,fail){
      var path = "data/"+file+".json";
      fs.readFile(path,function(error,data){
        var obj;
        if (error){
          console.log("error with reading file:"+file);
          console.log(error);
          obj = new UserObject;
          obj.id=file;
        }
        else{
          var obj = JSON.parse(data);
          obj.__proto__ = new UserObject;
        }
        success(obj);
      })
    }).catch((error)=>{console.log("error with parsing: "+data);})
  }
  static botStart(msg){
    var id = msg.from.id;
    console.log("user "+id+" starts bot");
    fs.readdir("data",function(error,data){
      if (error)
        console.log(error);
      if (data.includes(id+".json")==false){
          var obj = new UserObject;
          obj.id = id;
          obj.savetoFile();
          console.log("file for user "+id+" created");
      }
      else
        console.log("file for user "+id+" found");
    })
  }
  static sendMessage(id,message){
    bot.sendMessage(id,message).catch((error)=>{
      console.log("error with sending message to user with id:"+id+", message:"+message+", error:"+error);
    });
  }
  static checkConfirms(){
    fs.readdir("data/",function(error,data){
      if (error)
        conlose.error(error);
      data.forEach(function(element){
      if (element){
        var filename = element.toString();
        var filename = filename.slice(0,filename.length-".json".length);
        UserObject.readJsonFile(filename).then(function(obj){
          obj.checkAddress();
        })
      }
      })
    })
  }
}

class RequestObject{
  constructor(id,address,addressIndex){
    this.id = id;
    this.address = address;
    this.addressIndex = addressIndex;
    if (!RequestObject.requestOderSearch(this)){
      var l = requestOder.push(this);
    }
  }
  request(){
    var addressIndex = this.addressIndex;
    UserObject.readJsonFile(this.id).then(function(obj){
      obj.request(addressIndex);
      requestOder = requestOder.slice(1);
    }).catch((err)=>{console.log("error with request:"+err)});
  }
  competition(obj){
    if ((this.id == obj.id) && (this.address == obj.address) && (this.addressIndex == obj.addressIndex))
      return true;
    else
      return false;
  }
  static requestOderSearch(obj){
    var bool = false;
    requestOder.forEach((element)=>{
      if (element.competition(obj)==true)
        bool = true;
    })
    return bool;
  }
}
var requestOder = [];
setInterval(UserObject.checkConfirms,1000*20);
setInterval(() => {
  if (requestOder.length != 0)
    requestOder[0].request();
}, 1000*10);
bot.onText(/\/addaddress/,function(msg){
  var id = msg.from.id;
  UserObject.readJsonFile(msg.from.id).then(function(obj){
    obj.lastcommand = "addaddress"
    UserObject.sendMessage(id,"Отправь мне биткоин адрес, для которого нужно отслеживать подтверждения");
    obj.savetoFile();
  })
  setTimeout(function(){
    UserObject.readJsonFile(id).then(function(obj){
      if (obj.lastcommand == "addaddress"){
        obj.lastcommand = "null"
        obj.savetoFile();
        UserObject.sendMessage(id,"Ты так и не прислал адрес. Если решишь добавить адрес, воспользуйся командой.");
      }
    })
  },1000*60*5) 
});
bot.onText(/\/maxconfirms/,function(msg){
  var id = msg.from.id;
  UserObject.readJsonFile(msg.from.id).then(function(obj){
    obj.lastcommand = "maxConfirms"
    UserObject.sendMessage(obj.id,"До скольких подтверждений мне отслеживать транзакциии?");
    obj.savetoFile();
  })
  setTimeout(function(){
    UserObject.readJsonFile(id).then(function(obj){
      if (obj.lastcommand == "maxConfirms"){
        obj.lastcommand = "null"
        obj.savetoFile();
        UserObject.sendMessage(obj.id,"Ты так и не прислал число подтверждений. Если решишь изменить число, воспользуйся командой.");
      }
    })
  },1000*60*5) 
});
bot.onText(/\/myaddress/,function(msg){
  var id = msg.from.id;
  UserObject.sendMessage(id,"Добавленные адреса:");
  setTimeout(function(){
    UserObject.readJsonFile(id).then((obj)=>{
      obj.address.forEach((elem)=>UserObject.sendMessage(id,elem.address))
    }).catch((err)=>{console.log("error with sending adresses:"+err)})
  },1000*2);//задержка для правильного расположения сообщений
});
bot.on('text',function(msg){
  if (/\//.test(msg.text))
    return 0;
	UserObject.readJsonFile(msg.chat.id).then(function(obj){
    if (obj.lastcommand == "addaddress"){
      obj.checkAddressCorrect(msg.text);
    }
    if (obj.lastcommand == "maxConfirms"){
      obj.checkMaxConfirmsCorrect(msg.text);
    }
	}).catch((err)=>{});
});
