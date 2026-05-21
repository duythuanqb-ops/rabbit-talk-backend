const fs = require('fs');
const Tesseract = require('tesseract.js');

async function testOCR() {
  console.log("Starting OCR...");
  const { data: { text } } = await Tesseract.recognize(
    '../frontend/public/vocabulary.png',
    'eng',
    { logger: m => console.log(m) }
  );
  console.log("RAW TEXT:\n", text);
}
testOCR();
