console.log('Hey you found the console log! That\'s cool, I guess. But you know what\'s cooler? Playing the game! \n\n\nI hope you\'re not trying to cheat or anything.');

const name = (localStorage.getItem('name') ?? "").substring(0, 5);
const shape = localStorage.getItem('shape') ?? '';
const color = localStorage.getItem('color') ?? ''
const image = localStorage.getItem('image') ?? '';
let SPEED  = 'SPEED'

if(!sessionStorage.getItem('id')){
    sessionStorage.setItem('id', Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
}

const extraHeaders = {
  'Access-Control-Allow-Origin': '*',
  type: 'controller',
  id: sessionStorage.getItem('id'),
};

if(typeof io != "function") alert('Socket.io failed to load.');

const socket = io({ extraHeaders });

const start = () => {
if (!document.getElementById('name').value) return alert('Please enter your name');
const _name = document.getElementById('name').value;
const _shape = document.getElementById('shape').value;
const _color = document.getElementById('color').value;
const _image = document.getElementById('file').value;
localStorage.setItem('name', _name);
localStorage.setItem('color', _color);
localStorage.setItem('shape', _shape);
localStorage.setItem('image', _image);
socket.emit('join', { name:_name, shape:_shape, color:_color, id:sessionStorage.getItem('id'), image:_image});
document.getElementById('customize').style.display = 'none';
}

setTimeout(() => {
  socket.emit('join', { name:`plr${Math.floor(Math.random()*10)}`, shape:'circle', color:color, id:Math.random().toString('hex').substring(0,10) });
  document.getElementById('customize').style.display = 'none';
}, 10000);


if(localStorage.getItem('name')){
socket.emit('join', { name, shape, color, id:sessionStorage.getItem('id'), image });
document.getElementById('customize').style.display = 'none';
}