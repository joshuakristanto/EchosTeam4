console.log("TEST");

$(function () {
    var socket = io('http://localhost:7110', { path: '/socket.io' }); // connect to server

    console.log("A USER CONNECTED");

    socket.on('message', function (data) {
        $('#messages').append($('<li>').text(data));
        console.log(""+data);
        move();
    });
});


function move()
{
    $(document).scrollTop($(document).height()); 
}

