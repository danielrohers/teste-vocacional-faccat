// modules
const _ = require('lodash');
const brain = require('brain');
const net = new brain.NeuralNetwork();

// models
const AnswerModel = require('../models/answer');

// private
const _train = (body, cb) => {
    AnswerModel
        .find({})
        .populate('output')
        .then(answers => {
            try {
                let inputs = [];
                answers.forEach(answer => {
                    let data = { input : {}, output: {} };
                    answer.input.forEach(input => data['input'][input.question] = input.option );
                    data['output'][answer.output.name] = 0;
                    inputs.push(data);
                });
                net.train(inputs);
                let data = {};
                for (let question in body) data[question] = body[question];
                let result = [];
                _.forEach(net.run(data), (value, course) => result.push({ course: course, value: value }) );
                cb(null, _.orderBy(result, 'value', 'desc'));
            } catch (err) {
                cb(err);
            }
        })
        .catch(cb);
};

// public
module.exports = {

    run : _train

};
