const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de imagem inválido. Utilize JPG, PNG, WEBP ou SVG.'), false);
  }
};

const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
});

const uploadSpreadsheet = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadDocx = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const isDocxMime =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.originalname.toLowerCase().endsWith('.docx');
    if (isDocxMime) {
      cb(null, true);
    } else {
      cb(new Error('Envie um arquivo Word no formato .docx válido.'), false);
    }
  },
  limits: { fileSize: 8 * 1024 * 1024 },
});

module.exports = { uploadImage, uploadSpreadsheet, uploadDocx };
