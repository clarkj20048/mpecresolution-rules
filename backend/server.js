const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = 3001;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Uploads directory created');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

// Load admin credentials from JSON file
const adminCredentialsPath = path.join(__dirname, 'admin-credentials.json');
let adminCredentials = null;

try {
  const data = fs.readFileSync(adminCredentialsPath, 'utf8');
  adminCredentials = JSON.parse(data);
  console.log('Admin credentials loaded from JSON file');
} catch (err) {
  console.error('Error loading admin credentials:', err.message);
}

// Middleware
app.use(cors());
app.use(express.json());

// SQLite Database Setup
const dbPath = path.join(__dirname, 'mepc.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('Users table created/verified');
    }
  });

  // Create contacts table for contact form messages
  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating contacts table:', err.message);
    } else {
      console.log('Contacts table created/verified');
      createDefaultAdmin();
    }
  });
}

// Create default admin user
function createDefaultAdmin() {
  const defaultEmail = 'admin@mepc.com';
  const defaultPassword = 'admin123';
  
  bcrypt.hash(defaultPassword, 10, (err, hash) => {
    if (err) {
      console.error('Error hashing password:', err.message);
      return;
    }
    
    db.run(
      'INSERT OR IGNORE INTO users (email, password, role) VALUES (?, ?, ?)',
      [defaultEmail, hash, 'admin'],
      (err) => {
        if (err) {
          console.error('Error creating default admin:', err.message);
        } else {
          console.log('Default admin user created: ' + defaultEmail);
          console.log('Default password: admin123');
        }
      }
    );
  });
}

// API Routes

// Login endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  // First, check against JSON file credentials
  if (adminCredentials && adminCredentials.admin) {
    if (email === adminCredentials.admin.email && password === adminCredentials.admin.password) {
      return res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: 0,
          email: adminCredentials.admin.email,
          role: 'admin'
        }
      });
    }
  }
  
  // If not matched in JSON, check against database
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ error: 'Error comparing passwords' });
      }
      
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      });
    });
  });
});

// Register endpoint
app.post('/api/register', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      return res.status(500).json({ error: 'Error hashing password' });
    }
    
    db.run(
      'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
      [email, hash, 'admin'],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Error creating user' });
        }
        
        res.json({
          success: true,
          message: 'User registered successfully',
          userId: this.lastID
        });
      }
    );
  });
});

// Get all users (protected)
app.get('/api/users', (req, res) => {
  db.all('SELECT id, email, role, created_at FROM users', [], (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(users);
  });
});

// Delete user (protected)
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error deleting user' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
  });
});

// =====================
// JSON Database Helper Functions
// =====================
const resolutionsDbPath = path.join(__dirname, 'resolutions-db.json');
const pendingResolutionsPath = path.join(__dirname, 'pending-resolutions.json');
const recentlyViewedPath = path.join(__dirname, 'recently-viewed.json');
const resolutionTagsPath = path.join(__dirname, 'resolution-tags.json');

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
const DEFAULT_KEYWORD_COUNT = 10;

function readResolutionsDb() {
  try {
    const data = fs.readFileSync(resolutionsDbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {
      resolutions: [],
      metadata: {
        total: 0,
        months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
      }
    };
  }
}

function writeResolutionsDb(data) {
  fs.writeFileSync(resolutionsDbPath, JSON.stringify(data, null, 2));
}

function readPendingResolutions() {
  try {
    const data = fs.readFileSync(pendingResolutionsPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {
      pendingResolutions: [],
      metadata: {
        total: 0
      }
    };
  }
}

function writePendingResolutions(data) {
  fs.writeFileSync(pendingResolutionsPath, JSON.stringify(data, null, 2));
}

function readRecentlyViewed() {
  try {
    const data = fs.readFileSync(recentlyViewedPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {
      recentlyViewed: [],
      metadata: {
        total: 0,
        updated_at: null
      }
    };
  }
}

function writeRecentlyViewed(data) {
  fs.writeFileSync(recentlyViewedPath, JSON.stringify(data, null, 2));
}

function readResolutionTags() {
  try {
    const data = fs.readFileSync(resolutionTagsPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {
      tags: [],
      metadata: {
        total: 0,
        description: 'Auto-generated resolution tags and keywords',
        generated: new Date().toISOString().slice(0, 10)
      }
    };
  }
}

function writeResolutionTags(data) {
  fs.writeFileSync(resolutionTagsPath, JSON.stringify(data, null, 2));
}

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

async function upsertResolutionTag(resolution) {
  const tagsData = readResolutionTags();
  const normalizedFilePath = normalizeFilePath(resolution.file_path);
  const pdfText = await extractPdfTextFromFilePath(normalizedFilePath);
  const keywords = generateKeywordsFromText(resolution.title, pdfText, DEFAULT_KEYWORD_COUNT);
  const fallbackKeywords = generateKeywordsFromText(resolution.title, '', DEFAULT_KEYWORD_COUNT);
  const finalKeywords = keywords.length > 0 ? keywords : fallbackKeywords;

  const existingIndex = tagsData.tags.findIndex(
    (tag) => normalizeFilePath(tag.file_path) === normalizedFilePath
      || String(tag.title || '').trim().toLowerCase() === String(resolution.title || '').trim().toLowerCase()
  );

  if (existingIndex !== -1) {
    tagsData.tags[existingIndex] = {
      ...tagsData.tags[existingIndex],
      file_path: normalizedFilePath,
      title: resolution.title,
      keywords: finalKeywords
    };
  } else {
    const nextTagId = tagsData.tags.length > 0
      ? Math.max(...tagsData.tags.map((tag) => Number(tag.id) || 0)) + 1
      : 1;

    tagsData.tags.push({
      id: nextTagId,
      file_path: normalizedFilePath,
      title: resolution.title,
      keywords: finalKeywords
    });
  }

  tagsData.metadata = {
    ...(tagsData.metadata || {}),
    total: tagsData.tags.length,
    generated: new Date().toISOString().slice(0, 10)
  };

  writeResolutionTags(tagsData);
  return finalKeywords;
}

// =====================
// Resolutions API Routes (using JSON file)
// =====================

// Get all resolutions
app.get('/api/resolutions', (req, res) => {
  const dbData = readResolutionsDb();
  res.json(dbData.resolutions);
});

// Get single resolution by ID
app.get('/api/resolutions/:id', (req, res) => {
  const { id } = req.params;
  const dbData = readResolutionsDb();
  const resolution = dbData.resolutions.find(r => r.id === parseInt(id));
  
  if (!resolution) {
    return res.status(404).json({ error: 'Resolution not found' });
  }
  res.json(resolution);
});

// Get recently viewed resolutions
app.get('/api/recently-viewed', (req, res) => {
  const data = readRecentlyViewed();
  res.json(data.recentlyViewed);
});

// Add/update recently viewed resolution
app.post('/api/recently-viewed', (req, res) => {
  const { id, title, file_path, date_docketed, date_published } = req.body;

  if (!id || !title) {
    return res.status(400).json({ error: 'Resolution id and title are required' });
  }

  const data = readRecentlyViewed();
  const normalizedId = parseInt(id, 10);

  const entry = {
    id: Number.isNaN(normalizedId) ? id : normalizedId,
    title: String(title),
    file_path: file_path || '',
    date_docketed: date_docketed || '',
    date_published: date_published || '',
    viewed_at: new Date().toISOString()
  };

  const existing = data.recentlyViewed.filter((item) => item.id !== entry.id);
  data.recentlyViewed = [entry, ...existing].slice(0, 10);
  data.metadata.total = data.recentlyViewed.length;
  data.metadata.updated_at = new Date().toISOString();

  writeRecentlyViewed(data);

  res.json({
    success: true,
    message: 'Recently viewed updated',
    recentlyViewed: data.recentlyViewed
  });
});

// Clear recently viewed resolutions
app.delete('/api/recently-viewed', (req, res) => {
  const cleared = {
    recentlyViewed: [],
    metadata: {
      total: 0,
      updated_at: new Date().toISOString()
    }
  };

  writeRecentlyViewed(cleared);

  res.json({
    success: true,
    message: 'Recently viewed cleared',
    recentlyViewed: []
  });
});

// File upload endpoint for PDF
app.post('/api/upload', upload.single('pdfFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or invalid file type' });
  }
  
  res.json({
    success: true,
    message: 'File uploaded successfully',
    filePath: `/uploads/${req.file.filename}`,
    fileName: req.file.filename
  });
});

// Add new resolution
app.post('/api/resolutions', (req, res) => {
  let { title, month, year, file_path, date_docketed, date_published } = req.body;
  
  // Extract month and year from date_docketed if not provided separately
  if (date_docketed && !month) {
    const date = new Date(date_docketed);
    if (!isNaN(date.getTime())) {
      month = date.toLocaleString('default', { month: 'long' });
      year = date.getFullYear().toString();
    }
  }
  
  if (!title || !month || !year) {
    return res.status(400).json({ error: 'Title, month, and year are required' });
  }
  
  const dbData = readResolutionsDb();
  
  const newId = dbData.resolutions.length > 0 
    ? Math.max(...dbData.resolutions.map(r => r.id)) + 1 
    : 1;
  
  const newResolution = {
    id: newId,
    title,
    month,
    year: parseInt(year),
    file_path: file_path || '',
    date_docketed: date_docketed || '',
    date_published: date_published || '',
    created_at: new Date().toISOString()
  };
  
  dbData.resolutions.push(newResolution);
  dbData.metadata.total = dbData.resolutions.length;
  
  writeResolutionsDb(dbData);
  
  res.json({
    success: true,
    message: 'Resolution added successfully',
    resolutionId: newId
  });
});

// Update resolution
app.put('/api/resolutions/:id', (req, res) => {
  const { id } = req.params;
  const { title, month, year, file_path } = req.body;
  
  if (!title || !month || !year) {
    return res.status(400).json({ error: 'Title, month, and year are required' });
  }
  
  const dbData = readResolutionsDb();
  const index = dbData.resolutions.findIndex(r => r.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: 'Resolution not found' });
  }
  
  dbData.resolutions[index] = {
    ...dbData.resolutions[index],
    title,
    month,
    year: parseInt(year),
    file_path: file_path || ''
  };
  
  writeResolutionsDb(dbData);
  
  res.json({ success: true, message: 'Resolution updated successfully' });
});

// Delete resolution
app.delete('/api/resolutions/:id', (req, res) => {
  const { id } = req.params;
  
  const dbData = readResolutionsDb();
  const index = dbData.resolutions.findIndex(r => r.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: 'Resolution not found' });
  }
  
  const resolution = dbData.resolutions[index];
  if (resolution.file_path) {
    const filePath = path.join(__dirname, resolution.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  
  dbData.resolutions.splice(index, 1);
  dbData.metadata.total = dbData.resolutions.length;
  
  writeResolutionsDb(dbData);
  
  res.json({ success: true, message: 'Resolution deleted successfully' });
});

// =====================
// Pending Resolutions API Routes
// =====================

// Get all pending resolutions
app.get('/api/pending-resolutions', (req, res) => {
  const dbData = readPendingResolutions();
  res.json(dbData.pendingResolutions);
});

// Add new pending resolution
app.post('/api/pending-resolutions', (req, res) => {
  let { title, month, year, file_path, date_docketed, date_published } = req.body;
  
  // Extract month and year from date_docketed if not provided separately
  if (date_docketed && !month) {
    const date = new Date(date_docketed);
    if (!isNaN(date.getTime())) {
      month = date.toLocaleString('default', { month: 'long' });
      year = date.getFullYear().toString();
    }
  }
  
  if (!title || !month || !year) {
    return res.status(400).json({ error: 'Title, month, and year are required' });
  }
  
  const dbData = readPendingResolutions();
  
  const newId = dbData.pendingResolutions.length > 0 
    ? Math.max(...dbData.pendingResolutions.map(r => r.id)) + 1 
    : 1;
  
  const newResolution = {
    id: newId,
    title,
    month,
    year: parseInt(year),
    file_path: file_path || '',
    date_docketed: date_docketed || '',
    date_published: date_published || '',
    created_at: new Date().toISOString()
  };
  
  dbData.pendingResolutions.push(newResolution);
  dbData.metadata.total = dbData.pendingResolutions.length;
  
  writePendingResolutions(dbData);
  
  res.json({
    success: true,
    message: 'Pending resolution added successfully',
    resolutionId: newId
  });
});

// Accept pending resolution - transfer to resolutions-db.json
app.post('/api/pending-resolutions/:id/accept', async (req, res) => {
  const { id } = req.params;
  
  const pendingData = readPendingResolutions();
  const pendingIndex = pendingData.pendingResolutions.findIndex(r => r.id === parseInt(id));
  
  if (pendingIndex === -1) {
    return res.status(404).json({ error: 'Pending resolution not found' });
  }
  
  const pendingResolution = pendingData.pendingResolutions[pendingIndex];
  
  // Add to resolutions database
  const resolutionsData = readResolutionsDb();
  
  const newId = resolutionsData.resolutions.length > 0 
    ? Math.max(...resolutionsData.resolutions.map(r => r.id)) + 1 
    : 1;
  
  const approvedResolution = {
    id: newId,
    title: pendingResolution.title,
    month: pendingResolution.month,
    year: pendingResolution.year,
    file_path: pendingResolution.file_path,
    date_docketed: pendingResolution.date_docketed || '',
    date_published: pendingResolution.date_published || '',
    created_at: new Date().toISOString()
  };
  
  resolutionsData.resolutions.push(approvedResolution);
  resolutionsData.metadata.total = resolutionsData.resolutions.length;
  writeResolutionsDb(resolutionsData);

  let generatedKeywords = [];
  try {
    generatedKeywords = await upsertResolutionTag(approvedResolution);
  } catch (tagError) {
    console.error('Failed to generate resolution keywords:', tagError.message);
  }
  
  // Remove from pending
  pendingData.pendingResolutions.splice(pendingIndex, 1);
  pendingData.metadata.total = pendingData.pendingResolutions.length;
  writePendingResolutions(pendingData);
  
  res.json({ 
    success: true, 
    message: 'Resolution accepted and transferred to resolutions',
    resolution: approvedResolution,
    keywords: generatedKeywords
  });
});

// Reject pending resolution - delete from pending
app.post('/api/pending-resolutions/:id/reject', (req, res) => {
  const { id } = req.params;
  
  const pendingData = readPendingResolutions();
  const pendingIndex = pendingData.pendingResolutions.findIndex(r => r.id === parseInt(id));
  
  if (pendingIndex === -1) {
    return res.status(404).json({ error: 'Pending resolution not found' });
  }
  
  const pendingResolution = pendingData.pendingResolutions[pendingIndex];
  
  // Delete associated file if exists
  if (pendingResolution.file_path) {
    const filePath = path.join(__dirname, pendingResolution.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  
  // Remove from pending
  pendingData.pendingResolutions.splice(pendingIndex, 1);
  pendingData.metadata.total = pendingData.pendingResolutions.length;
  writePendingResolutions(pendingData);
  
  res.json({ 
    success: true, 
    message: 'Pending resolution rejected and deleted' 
  });
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// =====================
// Contacts API Routes
// =====================

// Get all contacts
app.get('/api/contacts', (req, res) => {
  db.all('SELECT * FROM contacts ORDER BY created_at DESC', [], (err, contacts) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(contacts);
  });
});

// Add new contact message
app.post('/api/contacts', (req, res) => {
  const { name, email, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }
  
  db.run(
    'INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)',
    [name, email, message],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error saving contact message' });
      }
      res.json({
        success: true,
        message: 'Contact message saved successfully',
        contactId: this.lastID
      });
    }
  );
});

// Delete contact message
app.delete('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM contacts WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error deleting contact message' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Contact message not found' });
    }
    res.json({ success: true, message: 'Contact message deleted successfully' });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Login API available at http://localhost:${PORT}/api/login`);
});
