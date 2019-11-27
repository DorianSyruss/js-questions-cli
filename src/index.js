const cheerio = require('cheerio');
const filter = require('lodash/filter');
const got = require('got');
const inquirer = require('inquirer');
const isEmpty = require('lodash/isEmpty');
const md = require('remarked');
const Rx = require('rxjs');

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

function getQuestionPrompt(questions) {
  console.clear();
  const { questionText, codeExample, choices, feedback = '' } = sample(questions);
  return {
    type: 'list',
    name: 'CHOICE',
    message: `${questionText}\n\n${codeExample}\n`,
    choices,
    suffix: 'Your choice is',
    filter: () => feedback
  };
}

function exitQuiz(prompts) {
  const footer = new inquirer.ui.BottomBar();
  footer.updateBottomBar('Thx for using, bye, bye! :)');
  return prompts.complete();
}

const CONTINUE_PROMPT = {
  type: 'confirm',
  name: 'CONTINUE',
  message: `Do you want to continue?`,
  default: true
};

(async () => {
  try {
    const response = await got(quizUrl);
    const quizMd = response.body;
    const quizHtml = await md(quizMd);
    const $ = cheerio.load(quizHtml);

    const questions = getQuestions($);

    const prompts = new Rx.Subject();
    const prompt = inquirer.prompt(prompts);

    prompts.next(getQuestionPrompt(questions));

    const onEachAnswer = (prevPrompt) => {
      console.info(prevPrompt.answer);
      if (prevPrompt.name !== CONTINUE_PROMPT.name) return prompts.next(CONTINUE_PROMPT);
      return !prevPrompt.answer
        ? exitQuiz(prompts)
        : prompts.next(getQuestionPrompt(questions));
    };
    prompt.ui.process.subscribe(onEachAnswer);
  } catch (error) {
    console.log(error);
  }
})();

function sample(array) {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array.splice(randomIndex, 1)[0] || {};
}
