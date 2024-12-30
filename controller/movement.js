const keysPressed = {};

socket.on('disconnect', () => {
  alert('You have been disconnected from the server.');
});

const startMove = (direction) => {
    if (!keysPressed[direction]) {
        keysPressed[direction] = setInterval(() => {
            socket.emit('move', direction);
        }, 'SPEED');
    }
};

const stopMove = (direction) => {
    clearInterval(keysPressed[direction]);
    delete keysPressed[direction];
};

const handleTouchStart = (direction) => (e) => {
    e.preventDefault();
    startMove(direction);
};

const handleTouchEnd = (direction) => (e) => {
    e.preventDefault();
    stopMove(direction);
};

const handleMouseDown = (direction) => () => {
    startMove(direction);
};

const handleMouseUp = (direction) => () => {
    stopMove(direction);
};

document.getElementById('f').addEventListener('mousedown', handleMouseDown('forward'));
document.getElementById('f').addEventListener('mouseup', handleMouseUp('forward'));
document.getElementById('b').addEventListener('mousedown', handleMouseDown('backward'));
document.getElementById('b').addEventListener('mouseup', handleMouseUp('backward'));
document.getElementById('l').addEventListener('mousedown', handleMouseDown('left'));
document.getElementById('l').addEventListener('mouseup', handleMouseUp('left'));
document.getElementById('r').addEventListener('mousedown', handleMouseDown('right'));
document.getElementById('r').addEventListener('mouseup', handleMouseUp('right'));

document.getElementById('f').addEventListener('touchstart', handleTouchStart('forward'));
document.getElementById('f').addEventListener('touchend', handleTouchEnd('forward'));
document.getElementById('b').addEventListener('touchstart', handleTouchStart('backward'));
document.getElementById('b').addEventListener('touchend', handleTouchEnd('backward'));
document.getElementById('l').addEventListener('touchstart', handleTouchStart('left'));
document.getElementById('l').addEventListener('touchend', handleTouchEnd('left'));
document.getElementById('r').addEventListener('touchstart', handleTouchStart('right'));
document.getElementById('r').addEventListener('touchend', handleTouchEnd('right'));


document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
        startMove('forward');
    } else if (e.key === 'ArrowDown') {
        startMove('backward');
    } else if (e.key === 'ArrowLeft') {
        startMove('left');
    } else if (e.key === 'ArrowRight') {
        startMove('right');
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') {
        stopMove('forward');
    } else if (e.key === 'ArrowDown') {
        stopMove('backward');
    } else if (e.key === 'ArrowLeft') {
        stopMove('left');
    } else if (e.key === 'ArrowRight') {
        stopMove('right');
    }
});

document.ontouchstart = (e) => {
    e.preventDefault();
};

socket.on("reload", () => {
    location.reload()
});

socket.on('error', (error) => {
    alert(error);
});