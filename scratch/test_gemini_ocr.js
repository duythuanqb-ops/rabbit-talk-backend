const apiKey = "AIzaSyD1M3w0Tkdp5WfzpojcwGqOD-_0nd4CQFo";
const model = "gemini-2.0-flash";

const rawText = `A EE
GLOSSARY dildhood (0) /faridhud/ ub the
” Communist /'komjamist Dhng Choe 54
Abbreviations Party of pati wv Vt
Gino: é
ad) adjective np noun phrase Viet Mam alu
adv advert y
ES or vil Yeysyon death (n) ~~ /det) di ditt
J! 1
defeat (v) Jdrfize/ nh bi
[ Unit1 devote to [diva ta] cng hién (cho)
account (n) ~~ </a'kaunt/ chu chuyén drop out (of). /'dropavt(e/ b% hoc
= ;
achievement /ofivmant/  thanhtich, “enemy (n) = enami/ Kethis
thanh tu ,
n Ae genius (n) /'&inias/ thién tai
2 0 () ad'mars (i 0
admire (v) [od'mats/ nguang mo hay hearst) anh hing
a [o'dopt/ 4 of
adopt (v) y'dpp! nhdn con nub marrage (n) mands] Sochonttan
animated (2 [‘®nimertid at hi
animated (adj) /®n1 / ~~ hoat hinh milfary (1) matey qui di
atts [o'tak/ Oc tan cong, < 
cig ’ 5 ng ig on cloud nine/ /on klaud natn/  r4t yui suéng,
ontopofthe  /2NtOP OVD hank oie
1d) he wa:ld//'suva 03
attend (school/ /o'tend (skuzl/ di hoc (trudng, world/overthe  ;n/
college) (vy KON] trong daihg, ~~ MOON
cao dang)
pancreatic (adj) / p@nkriztik/ ign quan tdi
battle (n) ['bigtl/ chién truong tuyén tuy
biography (n)  /bar'vgrafi/ — tiéu sit pass away [pais dwer/ qua di |
biological (adj) /bara'lodzikl/ (quan he) poem (n) /'pavim/ bai tho
rut thit be
poetry (n) /'pavatri/ tho ca
bond (v) /bond/ két than (val al) FT
resign (v) [ri'zamn/ tif chic
ner (n) ['kiensa/ ung thi al ak
ress [rizistans wai/ cugc khang |
“ity out [kari avt/ — tién hanh VE  chién 1`;

const prompt = `You are an expert English lexicographer, OCR post-processing engineer, and a meticulous quality checker.
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
7. Auto-correct obvious OCR spelling typos or character conversion errors in English words (e.g., "marrage" -> "marriage", "attacks", "enemy", "realize", "childhood").

PASS 2: Self-Verification & Double-Checking (CRITICAL FOR 99.9% ACCURACY)
- Re-scan the entire raw OCR text. For every Vietnamese definition or line showing a translation (e.g., "ung thư", "bài thơ", "tiểu sử", etc.), check if you have extracted its corresponding English word (e.g., "cancer", "poem", "biography").
- Ensure no words are skipped, especially short or common words, or words at the margins (like "childhood", "cancer", "bond").
- Verify that every single vocabulary item on the page is represented in your final array.

Return ONLY a valid JSON array of strings. Do not wrap it in markdown code blocks. Example: ["adopt", "biography", "devote to", "pass away"].

Here is the raw OCR text:
"${rawText.replace(/"/g, '\\"')}"`;

async function main() {
  const modelsToTry = [
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-pro-latest",
    "gemini-3-flash-preview"
  ];

  for (const model of modelsToTry) {
    console.log(`Trying model: ${model}...`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      const data = await response.json();
      if (data.error) {
        console.log(`Model ${model} failed with error:`, data.error.message || data.error);
        continue;
      }

      console.log(`\n🎉 Success with model: ${model}!`);
      console.log('Gemini API Full Response:', JSON.stringify(data, null, 2));
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textResponse) {
        const parsed = JSON.parse(textResponse.trim());
        console.log('\nParsed words length:', parsed.length);
        console.log(parsed);
        return; // Stop on first working model
      } else {
        console.log(`Could not retrieve textResponse from ${model} data.`);
      }
    } catch (e) {
      console.error(`Error trying model ${model}:`, e.message);
    }
  }
}

main().catch(console.error);
