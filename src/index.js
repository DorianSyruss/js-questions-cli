const cheerio = require('cheerio');
const filter = require('lodash/filter');
const got = require('got');
const inquirer = require('inquirer');
const isEmpty = require('lodash/isEmpty');
const md = require('remarked');

const quizUrl = 'https://raw.githubusercontent.com/DorianSyruss/javascript-questions/master/README.md';
const questionKeys = {
  h6: 'questionText',
  pre: 'codeExample',
  ul: 'choices',
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
    let value = $(questionProp).text();
    if (key === questionKeys.ul) value = parseChoices(questionProp);
    parsedQuestion[key] = value;
  });
  return parsedQuestion;
}

function parseChoices(questionChoices) {
  const $ = cheerio.load(questionChoices);
  return $('li').map((_, el) => $(el).text()).get();
}

(async () => {
  try {
    const response = await got(quizUrl);
    const quizMd = response.body;
    const quizHtml = await md(quizMd);
    const $ = cheerio.load(quizHtml);

    const questions = getQuestions($);
    const {
      choices,
      questionText,
      codeExample = '',
      feedback
    } = questions[Math.floor(Math.random() * questions.length)];

    inquirer.prompt([{
      type: 'list',
      name: 'CHOICE',
      message: `${questionText}\n\n${codeExample}\n`,
      choices: choices
    }])
      .then(answer => {
        console.log(`${answer.CHOICE}\n${feedback}`);
      });
  } catch (error) {
    console.log(error);
  }
})();

(async () => {
  // => response => { username, age, about }
})();
