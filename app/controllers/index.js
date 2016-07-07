// modules
const _ = require('lodash');
const async = require('async');

// models
const AnswerModel = require('../models/answer');
const QuestionModel = require('../models/question');
const CourseModel = require('../models/course');

// services
const BrainService = require('../services/brain');
const WekaService = require('../services/weka');

const _getQuestions = () => {
    return new Promise((resolve, reject) => {
        async.parallel({
            courses : cb => CourseModel.find({}).sort('name').exec(cb),
            questions : cb => QuestionModel.find({}, cb)
        }, (err, result) => {
            if (err) return reject(err);
            resolve({
                courses: result.courses,
                questions: result.questions
            });
        });
    });
};

const _train = input => {
    return new Promise((resolve, reject) => {
        async.parallel({
            weka : async.apply(WekaService.run, input),
            brain : async.apply(BrainService.run, input)
        }, (err, result) => {
            if (err) return reject(err);
            resolve(_.concat(result.weka, result.brain));
        });
    });
};

const _responseTrain = (req, res, result) => {
    req.flash('info', _.take(result, 3));
    res.render('question');
};

// public
module.exports = {

    render_index : (req, res) => {
        res.render('index');
    },

    render_student : (req, res, next) => {
        _getQuestions()
            .then(data => {
                data.isStudent = true;
                data.title = 'Estudante Faccat?';
                res.render('question', data);
            })
            .catch(next);
    },

    render_find : (req, res, next) => {
        _getQuestions()
            .then(data => {
                data.isStudent = false;
                data.title = 'Não estudante?';
                res.render('question', data);
            })
            .catch(next);
    },

    create : (req, res, next) => {
        let answer = new AnswerModel();
        answer.output = req.body.course;
        if (!!req.body.other_course && req.body.other_course != 'false') answer.output = req.body.other_course;
        delete req.body.course;
        delete req.body.other_course;

        answer.input = [];
        for (let question in req.body) {
            answer.input.push({
                question: question,
                option: req.body[question]
            });
        };

        answer.save(err => {
            if (err) return next(err);
            _train(req.body)
                .then(result => _responseTrain(req, res, result))
                .catch(next)
        });
    },

    find : (req, res, next) => {
        _train(req.body)
            .then(result => _responseTrain(req, res, result))
            .catch(next)
    }

};
