const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const resolutionsDbPath = path.join(__dirname, 'resolutions-db.json');
const resolutionTagsPath = path.join(__dirname, 'resolution-tags.json');
const DEFAULT_KEYWORD_COUNT = 10;

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'across', 'after', 'again', 'against', 'all', 'also', 'am', 'an', 'and',
  'any', 'are', 'as', 'at', 'be', 'been', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me',
  'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or',
  'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'you',
  'your', 'yours', 'yourself', 'yourselves',
  'resolution', 'series', 'erc', 'rules', 'rule', 'commission', 'energy', 'electric', 'electricity',
  'section', 'act', 'philippines', 'adopting', 'amending', 'guidelines', 'applications', 'application',
  'providing', 'policy', 'implementation', 'requirements', 'including', 'provided', 'pursuant'
]);

function normalizeFilePath(filePathValue) {
  if (!filePathValue) return '';
  const normalized = String(filePathValue).replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function resolveUploadFileAbsolutePath(filePathValue) {
  if (!filePathValue) return null;
  const relativePath = normalizeFilePath(filePathValue).replace(/^\/+/, '');
  return path.join(__dirname, relativePath);
}

function toTitleCase(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

function generateKeywordsFromText(title, text, maxKeywords = DEFAULT_KEYWORD_COUNT) {
  const keywords = [];
  const addKeyword = (value) => {
    const cleaned = String(value || '').trim();
    if (!cleaned) return;
    const normalized = cleaned.toLowerCase();
    if (keywords.some((item) => item.toLowerCase() === normalized)) return;
    keywords.push(toTitleCase(cleaned));
  };

  const titleTokens = tokenize(title);
  for (let i = 0; i < titleTokens.length - 1 && keywords.length < 4; i += 1) {
    addKeyword(`${titleTokens[i]} ${titleTokens[i + 1]}`);
  }
  for (let i = 0; i < titleTokens.length - 2 && keywords.length < 6; i += 1) {
    addKeyword(`${titleTokens[i]} ${titleTokens[i + 1]} ${titleTokens[i + 2]}`);
  }

  const bodyTokens = tokenize((text || '').slice(0, 40000));
  const bodyFreq = new Map();
  bodyTokens.forEach((token) => {
    bodyFreq.set(token, (bodyFreq.get(token) || 0) + 1);
  });

  const sortedBodyTokens = [...bodyFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token);

  for (const token of sortedBodyTokens) {
    if (keywords.length >= maxKeywords) break;
    addKeyword(token);
  }

  const bodyBigramFreq = new Map();
  for (let i = 0; i < bodyTokens.length - 1; i += 1) {
    const first = bodyTokens[i];
    const second = bodyTokens[i + 1];
    if (!first || !second || first === second) continue;
    const phrase = `${first} ${second}`;
    bodyBigramFreq.set(phrase, (bodyBigramFreq.get(phrase) || 0) + 1);
  }

  const sortedBodyBigrams = [...bodyBigramFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase);

  for (const phrase of sortedBodyBigrams) {
    if (keywords.length >= maxKeywords) break;
    addKeyword(phrase);
  }

  for (const token of titleTokens) {
    if (keywords.length >= maxKeywords) break;
    addKeyword(token);
  }

  const fallbackPhrases = [
    'Regulatory Compliance',
    'Policy Implementation',
    'Energy Sector',
    'Public Service',
    'Administrative Guidelines',
    'Resolution Framework'
  ];
  for (const phrase of fallbackPhrases) {
    if (keywords.length >= maxKeywords) break;
    addKeyword(phrase);
  }

  return keywords.slice(0, maxKeywords);
}

async function extractPdfTextFromFilePath(filePathValue) {
  const absolutePath = resolveUploadFileAbsolutePath(filePathValue);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return '';
  }

  const pdfBuffer = fs.readFileSync(absolutePath);
  const parsedPdf = await pdfParse(pdfBuffer);
  return parsedPdf && parsedPdf.text ? parsedPdf.text : '';
}

async function main() {
  const resolutionsData = JSON.parse(fs.readFileSync(resolutionsDbPath, 'utf8'));
  const resolutions = Array.isArray(resolutionsData.resolutions) ? resolutionsData.resolutions : [];

  const tags = [];
  for (const resolution of resolutions) {
    const filePath = normalizeFilePath(resolution.file_path);
    const pdfText = await extractPdfTextFromFilePath(filePath);
    const keywordsFromPdf = generateKeywordsFromText(resolution.title, pdfText, DEFAULT_KEYWORD_COUNT);
    const fallbackKeywords = generateKeywordsFromText(resolution.title, '', DEFAULT_KEYWORD_COUNT);

    tags.push({
      id: resolution.id,
      file_path: filePath,
      title: resolution.title,
      keywords: keywordsFromPdf.length > 0 ? keywordsFromPdf : fallbackKeywords
    });
  }

  const output = {
    tags,
    metadata: {
      total: tags.length,
      description: 'Auto-generated keywords and tags for MEPC Resolution and Rules PDF files for improved search functionality',
      generated: new Date().toISOString().slice(0, 10)
    }
  };

  fs.writeFileSync(resolutionTagsPath, JSON.stringify(output, null, 2));
  console.log(`Generated ${tags.length} tag entries with ${DEFAULT_KEYWORD_COUNT} keywords each.`);
}

main().catch((err) => {
  console.error('Failed to generate tags:', err.message);
  process.exit(1);
});
