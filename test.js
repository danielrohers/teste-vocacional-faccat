'use strict';

require('./config/mongoose');

const AnswerModel = require('./app/models/answer');
const CourseModel = require('./app/models/course');
const QuestionModel = require('./app/models/question');

const _ = require('lodash');
const brain = require('brain');
const net = new brain.NeuralNetwork();

const _train = answers => {
    let inputs = [];
    answers.forEach(answer => {
        let data = { input : {}, output: {} };
        answer.input.forEach(input => data['input'][input.question] = input.option );
        data['output'][answer.output.name] = 0;
        inputs.push(data);
    });
    net.train(inputs, {
        errorThresh: 0.005,  // error threshold to reach
        iterations: 20000,   // maximum training iterations
        log: true,           // console.log() progress periodically
        logPeriod: 10,       // number of iterations between logging
        learningRate: 0.3    // learning rate
    });
};

const _getInput = answer => {
    let data = {}
    answer.input.forEach(input => data[input.question] = input.option );
    return data;
};

const _getClassify = input => {
    let result = [];
    _.forEach(net.run(input), (value, course) => result.push({ course: course, value: value }) );
    return result;
};

AnswerModel
    .find({})
    .populate('output')
    .then(answers => {
        _train(answers);

        let answer = _.shuffle(answers)[0];
        console.log('course: ', answer.output.name);

        let input = _getInput(answer);
        let result = _getClassify(input);
        console.log('result: ',_.orderBy(result, 'value', 'desc'));
    })
    .catch(err => console.log('ERR: ', err));
