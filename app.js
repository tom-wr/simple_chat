var http = require('http'),
    io = require('socket.io'),
    fs = require('fs'),
    path = require('path'),
    amqp = require('amqp');

var connection = amqp.createConnection({host:'localhost'});
var server = http.createServer(handler).listen(8888);
var iosocket = io.listen(server);

// request/response handler
function handler(req, res){
    
    var pathname = req.url,
        basename = path.basename(pathname) || "index",
        ext = path.extname(pathname);

        if(!ext){
            basename += ".html";
        }

    console.log( "[-] requested: " + "/" + basename);
    fs.readFile(__dirname + "/" + basename,
        function(err, data) {
            if(err){
                res.writeHead(500);
                res.end("error: 500");
            }

            res.writeHead(200);
            res.end(data);
    });
}

// on connection to amqp server.
connection.on('ready', function(){
    console.log("[x] AMQP connection ready");
    // create new topic exchange
    var chatExchange = connection.exchange('chat_exchange', {type:"topic",autoDelete:true});
    // create queue for chatroom1
    var cr1 = connection.queue('chatroom1', function(chat_queue){
        console.log(" [-] queue "+chat_queue.name+" is open");
        chat_queue.bind('chat_exchange', 'chat.chat1');
        console.log(" [-] queue " +chat_queue.name+" bound to chat.chat1");  
    });
    // create queue for chatroom2
    var cri = connection.queue('chatroomindex', function(chat_queue){
        console.log(" [-] queue "+chat_queue.name+" is open");      
        chat_queue.bind('chat_exchange', 'chat.#');
        console.log(" [-] queue " +chat_queue.name+" bound to chat.#");
    });
    // on connection to socket.io
    iosocket.sockets.on('connection', function(socket){
        console.log("[x] Socket listener started");
        
        // on incoming message event
        socket.on('msg', function(data){
            console.log( "[-] message processing: "+data.msg+" from: "+data.src+" key: "+data.key);
            //publish message to amqp exchange with the routing key and message.
            chatExchange.publish(data.key, data);
        });
        // on message in chatroom one queue emit event to be recevied by chatroom1
        cr1.subscribe(function(message){
            console.log(" [-] received " +cr1.name +" message: "+message.msg);
            iosocket.sockets.emit("incoming_chat1", message);
        });
        // on message in chatrrom2 queue emit event to be received by chatroom2
        cri.subscribe(function(message){
            console.log(" [-] received " +cri.name +" message: "+message.msg);
            iosocket.sockets.emit("incoming_chat", message);
        });
    });
});