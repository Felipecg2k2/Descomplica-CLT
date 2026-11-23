const express = require('express');
const router = express.Router();
const { listPublicSubjects } = require('../controllers/subjectController');
const { getSettings } = require('../controllers/settingsController');
const {
  startQuizAttempt,
  submitQuestionAnswer,
  finishQuizAttempt,
} = require('../controllers/quizController');

router.get('/settings', getSettings);
router.get('/subjects', listPublicSubjects);

router.post('/quiz/start', startQuizAttempt);
router.post('/quiz/:attemptId/answer', submitQuestionAnswer);
router.post('/quiz/:attemptId/finish', finishQuizAttempt);

module.exports = router;
