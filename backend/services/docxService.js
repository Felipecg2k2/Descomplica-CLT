const mammoth = require('mammoth');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
} = require('docx');

function normalizeText(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?()\[\]"'“”‘’\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateStatementSimilarity(strA, strB) {
  const normA = normalizeText(strA);
  const normB = normalizeText(strB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const tokensA = new Set(normA.split(' ').filter((w) => w.length > 2));
  const tokensB = new Set(normB.split(' ').filter((w) => w.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  tokensA.forEach((t) => {
    if (tokensB.has(t)) intersection += 1;
  });

  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

async function generateQuestionsTemplateDocx() {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'DESCOMPLICA CLT — MODELO DE IMPORTAÇÃO DE QUESTÕES',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Orientações de preenchimento:',
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            text: '1. Preencha o nome do tema logo após o marcador "TEMA:". Se o tema já existir no sistema, as questões serão associadas a ele automaticamente; caso contrário, um novo tema será criado.',
          }),
          new Paragraph({
            text: '2. O campo "DESCRICAO:" é opcional e aparece na tela de apresentação do quiz para o aluno.',
          }),
          new Paragraph({
            text: '3. Cada questão deve iniciar com "QUESTÃO 1:", "QUESTÃO 2:", etc., seguido do enunciado e das quatro alternativas identificadas por A), B), C) e D).',
          }),
          new Paragraph({
            text: '4. Preencha obrigatoriamente "RESPOSTA CORRETA:" (A, B, C ou D) e "FEEDBACK PARA RESPOSTA CORRETA:".',
          }),
          new Paragraph({
            spacing: { after: 300 },
            border: {
              bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
            text: '5. Para o erro, utilize "FEEDBACK PARA RESPOSTA INCORRETA:" (feedback geral) OU informe feedbacks específicos por alternativa errada usando "FEEDBACK ALTERNATIVA A:", "FEEDBACK ALTERNATIVA B:", etc.',
          }),

          new Paragraph({
            spacing: { before: 200 },
            children: [
              new TextRun({ text: 'TEMA: ', bold: true }),
              new TextRun('Jornada de trabalho e controle de ponto'),
            ],
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({ text: 'DESCRICAO: ', bold: true }),
              new TextRun('Conceitos fundamentais sobre duração do trabalho, horas extras e intervalos previstos na CLT.'),
            ],
          }),

          // Questão 1 (Exemplo com Feedback Geral)
          new Paragraph({
            children: [new TextRun({ text: 'QUESTÃO 1:', bold: true })],
          }),
          new Paragraph({
            text: 'O que são horas extras?',
          }),
          new Paragraph({
            text: 'A) O período de jornada normal do colaborador.',
          }),
          new Paragraph({
            text: 'B) O período trabalhado além da jornada normal.',
          }),
          new Paragraph({
            text: 'C) O período de férias do trabalhador.',
          }),
          new Paragraph({
            spacing: { after: 120 },
            text: 'D) O tempo de descanso entre jornadas.',
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'RESPOSTA CORRETA: ', bold: true }),
              new TextRun('B'),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'FEEDBACK PARA RESPOSTA CORRETA:', bold: true }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            text: 'A hora extra acontece quando o trabalhador ultrapassa sua jornada normal de trabalho, conforme os limites legais e contratuais aplicáveis.',
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'FEEDBACK PARA RESPOSTA INCORRETA:', bold: true }),
            ],
          }),
          new Paragraph({
            spacing: { after: 280 },
            text: 'A alternativa correta é B. As horas extras correspondem ao período trabalhado além da jornada normal, respeitando os limites legais e contratuais.',
          }),

          // Questão 2 (Exemplo com Feedback Individual por Alternativa)
          new Paragraph({
            children: [new TextRun({ text: 'QUESTÃO 2:', bold: true })],
          }),
          new Paragraph({
            text: 'Qual é o intervalo intrajornada mínimo obrigatório para jornadas contínuas que excedam 6 horas diárias, segundo a regra geral da CLT?',
          }),
          new Paragraph({
            text: 'A) 15 minutos.',
          }),
          new Paragraph({
            text: 'B) 30 minutos.',
          }),
          new Paragraph({
            text: 'C) 1 hora.',
          }),
          new Paragraph({
            spacing: { after: 120 },
            text: 'D) 2 horas.',
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'RESPOSTA CORRETA: ', bold: true }),
              new TextRun('C'),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'FEEDBACK PARA RESPOSTA CORRETA:', bold: true }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            text: 'Correto! Pelo art. 71 da CLT, em qualquer trabalho contínuo cuja duração exceda 6 horas, é obrigatória a concessão de um intervalo de no mínimo 1 hora.',
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'FEEDBACK ALTERNATIVA A:', bold: true }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            text: 'O intervalo mínimo de 15 minutos aplica-se apenas às jornadas acima de 4 horas até o limite de 6 horas diárias. Para mais de 6 horas, o mínimo é de 1 hora.',
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'FEEDBACK ALTERNATIVA B:', bold: true }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            text: '30 minutos não é o mínimo legal padrão para jornadas acima de 6 horas contínuas; a CLT estabelece o mínimo de 1 hora.',
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'FEEDBACK ALTERNATIVA D:', bold: true }),
            ],
          }),
          new Paragraph({
            text: '2 horas corresponde ao limite máximo padrão do intervalo intrajornada na CLT, e não ao mínimo obrigatório de 1 hora.',
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

async function parseQuestionsFromDocxBuffer(buffer) {
  const { value: rawText } = await mammoth.extractRawText({ buffer });

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let themeName = '';
  let themeDescription = '';
  const questionBlocks = [];
  let currentBlock = null;
  let startedContent = false;

  for (const line of lines) {
    const themeMatch = line.match(/^TEMA\s*:\s*(.+)$/i);
    if (themeMatch) {
      startedContent = true;
      themeName = themeMatch[1].trim();
      continue;
    }

    const descMatch = line.match(/^DESCRI[CÇ][AÃ]O\s*:\s*(.+)$/i);
    if (descMatch && startedContent && !currentBlock) {
      themeDescription = descMatch[1].trim();
      continue;
    }

    const qHeaderMatch = line.match(/^QUEST[AÃ]O\s*\d*\s*(?:\[ID\s*:\s*([a-f0-9-]{36})\])?\s*:\s*(.*)$/i);
    if (qHeaderMatch) {
      startedContent = true;
      if (currentBlock) {
        questionBlocks.push(currentBlock);
      }
      currentBlock = {
        question_number: questionBlocks.length + 1,
        explicit_id: qHeaderMatch[1] ? qHeaderMatch[1].trim() : null,
        raw_lines: [],
      };
      if (qHeaderMatch[2] && qHeaderMatch[2].trim()) {
        currentBlock.raw_lines.push(qHeaderMatch[2].trim());
      }
      continue;
    }

    if (startedContent && currentBlock) {
      currentBlock.raw_lines.push(line);
    }
  }

  if (currentBlock) {
    questionBlocks.push(currentBlock);
  }

  const parsedQuestions = questionBlocks.map((block) => {
    let section = 'statement';
    const statementLines = [];
    const options = { A: '', B: '', C: '', D: '' };
    let lastOptionKey = null;
    let correctOption = '';
    const fbCorrectLines = [];
    const fbIncorrectLines = [];
    const fbIndLines = { A: [], B: [], C: [], D: [] };

    for (const line of block.raw_lines) {
      const corrMatch = line.match(/^RESPOSTA\s+CORRETA\s*:\s*(.*)$/i);
      if (corrMatch) {
        const val = corrMatch[1].trim().toUpperCase().replace(/[^A-D]/g, '');
        correctOption = val.charAt(0) || '';
        section = 'after_correct';
        continue;
      }

      const fbCorrMatch = line.match(/^FEEDBACK\s+(?:PARA\s+)?RESPOSTA\s+CORRETA\s*:\s*(.*)$/i);
      if (fbCorrMatch) {
        section = 'feedback_correct';
        if (fbCorrMatch[1] && fbCorrMatch[1].trim()) {
          fbCorrectLines.push(fbCorrMatch[1].trim());
        }
        continue;
      }

      const fbIndMatch = line.match(/^FEEDBACK\s+(?:PARA\s+)?ALTERNATIVA\s+([A-D])\s*:\s*(.*)$/i);
      if (fbIndMatch) {
        const optKey = fbIndMatch[1].toUpperCase();
        section = `feedback_ind_${optKey}`;
        if (fbIndMatch[2] && fbIndMatch[2].trim()) {
          fbIndLines[optKey].push(fbIndMatch[2].trim());
        }
        continue;
      }

      const fbIncMatch = line.match(/^FEEDBACK\s+(?:PARA\s+)?RESPOSTA\s+INCORRETA\s*:\s*(.*)$/i);
      if (fbIncMatch) {
        section = 'feedback_incorrect';
        if (fbIncMatch[1] && fbIncMatch[1].trim()) {
          fbIncorrectLines.push(fbIncMatch[1].trim());
        }
        continue;
      }

      const optMatch = line.match(/^([A-D])\s*[\)\.\-:]\s*(.+)$/i);
      if (optMatch && (section === 'statement' || section === 'options')) {
        section = 'options';
        const key = optMatch[1].toUpperCase();
        options[key] = optMatch[2].trim();
        lastOptionKey = key;
        continue;
      }

      if (section === 'statement') {
        statementLines.push(line);
      } else if (section === 'options' && lastOptionKey) {
        options[lastOptionKey] = `${options[lastOptionKey]} ${line}`.trim();
      } else if (section === 'feedback_correct') {
        fbCorrectLines.push(line);
      } else if (section === 'feedback_incorrect') {
        fbIncorrectLines.push(line);
      } else if (section.startsWith('feedback_ind_')) {
        const optKey = section.replace('feedback_ind_', '');
        fbIndLines[optKey].push(line);
      }
    }

    const statement = statementLines.join(' ').trim();
    const feedback_correct = fbCorrectLines.join(' ').trim();
    const feedback_incorrect = fbIncorrectLines.join(' ').trim();
    const feedback_incorrect_a = fbIndLines.A.join(' ').trim();
    const feedback_incorrect_b = fbIndLines.B.join(' ').trim();
    const feedback_incorrect_c = fbIndLines.C.join(' ').trim();
    const feedback_incorrect_d = fbIndLines.D.join(' ').trim();

    const hasAnyIndividual = Boolean(
      feedback_incorrect_a || feedback_incorrect_b || feedback_incorrect_c || feedback_incorrect_d
    );
    const feedback_mode = hasAnyIndividual ? 'individual' : 'general';

    const errors = [];
    if (!statement) errors.push('Enunciado ausente');
    if (!options.A || !options.B || !options.C || !options.D) {
      errors.push('Uma ou mais alternativas (A, B, C, D) estão ausentes');
    }
    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
      errors.push('Resposta correta deve ser A, B, C ou D');
    }
    if (!feedback_correct) {
      errors.push('Feedback para resposta correta ausente');
    }

    if (feedback_mode === 'individual') {
      const indMap = {
        A: feedback_incorrect_a,
        B: feedback_incorrect_b,
        C: feedback_incorrect_c,
        D: feedback_incorrect_d,
      };
      ['A', 'B', 'C', 'D'].forEach((opt) => {
        if (opt !== correctOption && !indMap[opt]) {
          errors.push(`Feedback individual da alternativa ${opt} ausente`);
        }
      });
    } else if (!feedback_incorrect) {
      errors.push('Feedback para resposta incorreta ausente');
    }

    return {
      question_number: block.question_number,
      explicit_id: block.explicit_id,
      statement,
      option_a: options.A,
      option_b: options.B,
      option_c: options.C,
      option_d: options.D,
      correct_option: correctOption,
      feedback_correct,
      feedback_mode,
      feedback_incorrect,
      feedback_incorrect_a: correctOption === 'A' ? null : feedback_incorrect_a || null,
      feedback_incorrect_b: correctOption === 'B' ? null : feedback_incorrect_b || null,
      feedback_incorrect_c: correctOption === 'C' ? null : feedback_incorrect_c || null,
      feedback_incorrect_d: correctOption === 'D' ? null : feedback_incorrect_d || null,
      is_valid: errors.length === 0,
      errors,
    };
  });

  return {
    theme_name: themeName,
    theme_description: themeDescription,
    questions: parsedQuestions,
  };
}

module.exports = {
  normalizeText,
  calculateStatementSimilarity,
  generateQuestionsTemplateDocx,
  parseQuestionsFromDocxBuffer,
};
