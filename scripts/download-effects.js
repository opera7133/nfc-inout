const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

const downloadEffects = async () => {
  const {data: successSound} = await axios.get('https://soundeffect-lab.info/sound/button/mp3/decision35.mp3', {
    responseType: 'arraybuffer',
    headers: {
      'Content-Type': 'audio/mpeg'
    }
  })
  await fs.writeFile(path.join(__dirname, "..", "src", 'success.mp3'), successSound)
  const {data: errorSound} = await axios.get('https://soundeffect-lab.info/sound/button/mp3/beep1.mp3', {
    responseType: 'arraybuffer',
    headers: {
      'Content-Type': 'audio/mpeg'
    }
  })
  await fs.writeFile(path.join(__dirname, "..", "src", 'error.mp3'), errorSound)
}

downloadEffects()
