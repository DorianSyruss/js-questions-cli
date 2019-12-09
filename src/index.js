#!/usr/bin/env node

const { prefixUrl } = require('../package.json').config;

const cardinal = require('cardinal');
const chalk = require('chalk');
const exitHook = require('exit-hook');
const { format } = require('util');
const got = require('got').extend({ prefixUrl });
const inquirer = require('inquirer');
const { Subject } = require('rxjs');
const unified = require('unified');
const wrapAnsi = require('wrap-ansi');

const space = ' ';
const tab = '\t';
const lineFeed = '\n';
const blank = lineFeed + lineFeed;

const supportsEmoji = process.platform !== 'win32' &&
  process.env.TERM === 'xterm-256color';

const continuePrompt = {
  type: 'confirm',
  name: '\0continue',
  message: 'Do you want to continue?',
  default: true
};

class QuestionPrompt extends inquirer.prompt.prompts.list {
  static type() {
    return 'question';
  }

  getQuestion() {
    const { message, prefix, suffix } = this.opt;
    return [
      prefix + chalk.reset() + space + message,
      space,
      suffix + space
    ].join(lineFeed);
  }
}
inquirer.registerPrompt(QuestionPrompt.type, QuestionPrompt);

function getQuestions(mdtree) {
  const delimiters = mdtree.children.filter(node => node.type === 'thematicBreak');
  return delimiters.reduce((acc, currentDelimiter, index, arr) => {
    const nextDelimiter = arr[index + 1];
    const startIndex = mdtree.children.indexOf(currentDelimiter) + 1;
    const endIndex = nextDelimiter ? mdtree.children.indexOf(nextDelimiter) : undefined;
    const questionNodes = mdtree.children.slice(startIndex, endIndex);
    const parsedQuestion = parseQuestion(questionNodes);
    acc.push(parsedQuestion);
    return acc;
  }, []);
}

function parseQuestion(questionNodes) {
  const heading = questionNodes.find(node => node.type === 'heading');
  const code = questionNodes.find(node => node.type === 'code', questionNodes.indexOf(heading));
  const list = questionNodes.find(node => node.type === 'list', questionNodes.indexOf(code));

  const detailsStart = questionNodes.find(node => {
    return node.type === 'html' && node.value.startsWith('<details>');
  }, questionNodes.indexOf(list));
  const detailsEnd = questionNodes.find(node => {
    return node.type === 'html' && node.value.endsWith('</details>');
  }, questionNodes.indexOf(detailsStart));
  const details = questionNodes.slice(
    questionNodes.indexOf(detailsStart) + 1,
    questionNodes.indexOf(detailsEnd)
  );

  const questionText = toString(heading);
  const codeExample = code ? toString(code) : '';
  const choices = list.children.map(node => toString(node));
  const feedback = details.map(node => toString(node)).join(blank);
  return { questionText, codeExample, choices, feedback };
}

function getQuestionPrompt(questions) {
  const {
    index,
    questionText = '',
    codeExample = '',
    choices = [],
    feedback = ''
  } = sample(questions);

  const message = [
    wrapAnsi(questionText, 80),
    codeExample && space,
    codeExample && codeExample
  ].filter(Boolean).join(lineFeed);

  console.clear();
  return {
    type: QuestionPrompt.type,
    name: format('question:%d', index),
    message,
    choices,
    suffix: 'Your choice is',
    filter() {
      const output = [
        lineFeed + 'Available choices were:',
        choices.join(lineFeed),
        feedback + lineFeed
      ].join(blank);
      return wrapAnsi(output, 80);
    }
  };
}

function stringify() {
  const { visitors } = this.Compiler.prototype;
  const { html, inlineCode } = visitors;
  Object.assign(visitors, {
    code(node) {
      const content = node.value.replace(new RegExp(tab, 'g'), space + space);
      if (node.lang !== 'javascript' && node.lang !== 'js') {
        return content;
      }
      return cardinal.highlight(content);
    },
    emphasis(node) {
      const content = this.all(node).join('');
      return chalk.italic(content);
    },
    heading(node) {
      const content = this.all(node).join('');
      if (content.startsWith('Answer:')) {
        return chalk.bold.green(content.replace(/^Answer:/, 'Correct answer:'));
      }
      if (/^\d+\./.test(content)) {
        return chalk.underline(content);
      }
      return content;
    },
    html(node) {
      if (!node.value.startsWith('<img')) {
        return html.call(this, node);
      }
      const fragment = rehype({ fragment: true }).parse(node.value);
      const [img] = fragment.children;
      return format('<%s>', img.properties.src);
    },
    inlineCode(node) {
      const value = inlineCode.call(this, node);
      return chalk.yellow(value.slice(1, -1));
    },
    listItem(node) {
      const values = node.children.map(child => this.visit(child, node));
      return values.join(lineFeed);
    },
    strong(node) {
      const content = this.all(node).join('');
      return chalk.bold(content);
    }
  });
}

function exitQuiz() {
  const footer = new inquirer.ui.BottomBar();
  footer.updateBottomBar(format(
    '\nThx for using, bye, bye! %s\n',
    supportsEmoji ? '😃' : ':)'
  ));
}

(async () => {
  try {
    exitHook(() => exitQuiz());

    const { body } = await got('en-EN/README.md');
    const mdtree = remark().parse(body);
    const questions = getQuestions(mdtree);

    const prompts = new Subject();
    const prompt = inquirer.prompt(prompts);

    prompts.next(getQuestionPrompt(questions));
    prompt.ui.process.subscribe(prevPrompt => {
      if (prevPrompt.name !== continuePrompt.name) {
        console.log(prevPrompt.answer);
        return prompts.next(continuePrompt);
      }
      return prevPrompt.answer
        ? prompts.next(getQuestionPrompt(questions))
        : prompts.complete();
    });
  } catch (error) {
    console.error(error.stack);
    process.exit(1);
  }
})();

function remark(options = {}) {
  return unified()
    .use(require('remark-parse'), options)
    .freeze();
}

function rehype(options = {}) {
  return unified()
    .use(require('rehype-parse'), options)
    .freeze();
}

function sample(array) {
  const randomIndex = Math.floor(Math.random() * array.length);
  const item = array.splice(randomIndex, 1)[0];
  item.index = randomIndex;
  return item;
}

function toString(tree) {
  return unified()
    .use(require('remark-stringify'))
    .use(stringify)
    .stringify(tree);
}
