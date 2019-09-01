const got = require('got');
const md = require('remarked');
const cheerio = require('cheerio');
const filter = require('lodash/filter');
const isEmpty = require('lodash/isEmpty');

const quizUrl = 'https://raw.githubusercontent.com/DorianSyruss/javascript-questions/master/README.md';
const questionKeys = {
  h6: 'questionText',
  pre: 'codeExample',
  ul: 'answer',
  details: 'feedback'
};

function getQuestions($) {
  const questions = [];
  $('hr').map((_, el) => $(el).nextUntil('hr'))
    .each((_, question) => {
      const parsedQuestion = parseQuestion($, question);
      questions.push(parsedQuestion);
    });
  return filter(questions, it => !isEmpty(it));
}

function parseQuestion($, question) {
  const parsedQuestion = {};
  question.each((_, questionProp) => {
    const { tagName } = questionProp;
    const key = questionKeys[tagName];
    const value = $(questionProp).text();
    parsedQuestion[key] = value;
  });
  return parsedQuestion;
}

(async () => {
  try {
    const response = await got(quizUrl);
    const quizMd = response.body;
    const quizHtml = await md(quizMd);
    const $ = cheerio.load(quizHtml);

    const questions = getQuestions($);
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    console.log(randomQuestion);
  } catch (error) {
    console.log(error);
  }
})();
