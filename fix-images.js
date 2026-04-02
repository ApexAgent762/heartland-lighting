const sharp = require('sharp');
sharp('public/images/IMG_8072.jpeg')
  .rotate()
  .toFile('public/images/IMG_8072_fixed.jpeg', (err) => {
    if(err) console.log('Error:', err);
    else console.log('Fixed!');
  });
