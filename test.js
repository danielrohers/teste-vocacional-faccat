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
        data['output'][answer.output.name] = 1;
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

AnswerModel
    .find({})
    .populate('output')
    .then(answers => {
        let select = _.take(_.shuffle(answers), 15);

        _train(answers);

        select.forEach(answer => {
            console.log("course: ", answer.output.name);

            let data = {};
            answer.input.forEach(input => data[input.question] = input.option );

            let result = [];
            _.forEach(net.run(data), (value, course) => result.push({ course: course, value: value }) );
            console.log(_.orderBy(result, 'value', 'desc'));
        })
    })
    .catch(err => console.log('ERR: ', err));
