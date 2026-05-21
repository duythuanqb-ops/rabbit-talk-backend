const Tesseract = require('tesseract.js');
const fetch = require('node-fetch');

const apiKey = "AIzaSyD1M3w0Tkdp5WfzpojcwGqOD-_0nd4CQFo";
const imagePath = '/Users/duythuan/.gemini/antigravity/brain/d4faa1d3-41ea-4854-810a-f687617d6306/media__1779292296801.jpg';

const prompt_template = (rawText) => `You are an expert English lexicographer, OCR post-processing engineer, and a meticulous quality checker.
Your task is to analyze raw OCR text extracted from an English textbook (which contains vocabulary words, phonetics like /.../ or [...], and Vietnamese translations/definitions) and extract an extremely clean, accurate, and 100% complete list of English vocabulary words and phrases.

To achieve 99.9% accuracy, you MUST perform a two-pass analysis:

PASS 1: Extraction
1. Extract ONLY valid English vocabulary words, collocations, or functional phrases/idioms (e.g., "adopt", "biography", "devote to", "pass away", "on cloud nine", "make a difference").
2. DO NOT include phonetic spellings (like /əˈdɒpt/, [biography], /bænd/, etc.).
3. DO NOT include Vietnamese words, definitions, or explanations.
4. DO NOT extract grammatical terms, parts of speech, or abbreviation legends (such as "adj", "adjective", "adv", "adverb", "n", "noun", "np", "noun phrase", "v", "verb") typically found in headers or glossary abbreviation boxes.
5. DO NOT split cohesive multi-word terms, proper nouns, or collocations into single individual words. Keep them intact!
   - Example: "Communist Party of Viet Nam" must remain a single array entry: "Communist Party of Viet Nam" (DO NOT split it into "Communist", "Party", "Vietnam").
   - Example: "resistance war" must remain intact: "resistance war" (DO NOT extract only "resistance").
6. DO NOT split lists of synonyms/alternatives separated by slashes. Keep them together as a single intact string entry just as they appear in the textbook!
   - Example: "on cloud nine/on top of the world/over the moon" must remain a single array entry: "on cloud nine/on top of the world/over the moon" (DO NOT split them into separate array items).
   - For words with situational parentheses like "attend (school/college)", clean it to its root form "attend".
7. Auto-correct obvious OCR spelling typos or character conversion errors in English words (e.g., "marrage" -> "marriage", "atts" -> "attacks", "enami" -> "enemy", "Jdrfize" -> "realize", "childhcod" -> "childhood", "dildhood" -> "childhood").

PASS 2: Self-Verification & Double-Checking (CRITICAL FOR 99.9% ACCURACY)
- Re-scan the entire raw OCR text. For every Vietnamese definition or line showing a translation (e.g., "ung thư", "bài thơ", "tiểu sử", etc.), check if you have extracted its corresponding English word (e.g., "cancer", "poem", "biography").
- Ensure no words are skipped, especially short or common words, or words at the margins (like "childhood", "cancer", "bond").
- Verify that every single vocabulary item on the page is represented in your final array.

Return ONLY a valid JSON array of strings. Do not wrap it in markdown code blocks. Example: ["adopt", "biography", "devote to", "pass away"].

Here is the raw OCR text:
"${rawText.replace(/"/g, '\\"')}"`;

async function callGemini(text) {
  const model = "gemini-3.1-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt_template(text) }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function main() {
  console.log('=== STEP 1: Running Tesseract.js OCR on the image ===');
  const result = await Tesseract.recognize(imagePath, 'eng', {
    logger: m => {
      if (m.status === 'recognizing text') {
        process.stdout.write(`\rOCR progress: ${Math.round(m.progress * 100)}%`);
      }
    }
  });
  console.log('\n');

  const rawText = result.data.text || '';
  console.log('=== RAW TEXT FROM TESSERACT (exact bytes sent to backend) ===');
  console.log(JSON.stringify(rawText)); // JSON stringify to see hidden chars
  console.log('\n=== HUMAN READABLE RAW TEXT ===');
  console.log(rawText);

  console.log('\n=== STEP 2: Sending to Gemini AI ===');
  const geminiResult = await callGemini(rawText);
  
  console.log('\n=== GEMINI RAW RESPONSE TEXT ===');
  console.log(geminiResult);

  try {
    const parsed = JSON.parse(geminiResult.trim());
    console.log(`\n=== PARSED WORDS (${parsed.length} total) ===`);
    parsed.forEach((w, i) => console.log(`  ${i+1}. "${w}"`));
    
    // Check for childhood
    const hasChildhood = parsed.some(w => w.toLowerCase().includes('childhood'));
    console.log(`\n=== CHILDHOOD PRESENT? ${hasChildhood ? '✅ YES' : '❌ NO'} ===`);
  } catch(e) {
    console.error('Failed to parse Gemini response as JSON:', e.message);
  }
}

main().catch(console.error);
