'use strict';

var gulp = require('gulp');
var ts = require('gulp-typescript');
var tsProject = ts.createProject('tsconfig.json');
var babel = require('gulp-babel');
var sourcemaps = require('gulp-sourcemaps');
var merge = require('merge-stream');
var plumber = require('gulp-plumber');
var fs = require('fs-extra');

var spawn = require('child_process').spawn;

const parcelBuild = (file, target) =>
    new Promise((resolve, reject) => {
        const parcel = spawn(
            'parcel',
            ['build', file, '--target', target || 'browser'],
            {
                shell: true,
            }
        );

        parcel.stderr.pipe(process.stderr);
        parcel.stdout.pipe(process.stdout);

        parcel.once('exit', number => {
            if (number == 0) {
                return resolve();
            }
            return reject(number);
        });
    });

const doc = () =>
    new Promise((resolve, reject) => {
        const parcel = spawn('typedoc', ['--out', './doc'], {
            shell: true,
        });

        parcel.stderr.pipe(process.stderr);
        parcel.stdout.pipe(process.stdout);

        parcel.once('exit', number => {
            if (number == 0) {
                return resolve();
            }
            return reject(number);
        });
    });

gulp.task('doc', function(done) {
    return doc().then(_ => done());
});

const pbjs = (...files) =>
    new Promise((resolve, reject) => {
        const parcel = spawn(
            'pbjs',
            [
                '-t',
                'static-module',
                '-w',
                'es6',
                '-o',
                'types/compiled.js',
                ...files,
            ],
            {
                shell: true,
            }
        );

        parcel.stderr.pipe(process.stderr);
        parcel.stdout.pipe(process.stdout);

        parcel.once('exit', number => {
            if (number == 0) {
                return resolve();
            }
            return reject(number);
        });
    });

const pbts = _ =>
    new Promise((resolve, reject) => {
        const parcel = spawn(
            'pbts',
            ['-o', 'types/compiled.d.ts', './types/compiled.js'],
            {
                shell: true,
            }
        );

        parcel.stderr.pipe(process.stderr);
        parcel.stdout.pipe(process.stdout);

        parcel.once('exit', number => {
            if (number == 0) {
                return resolve();
            }
            return reject(number);
        });
    });

const compile = babelOpts => {
    var tsResult = tsProject
        .src()
        .pipe(plumber())
        .pipe(sourcemaps.init())
        .pipe(tsProject());
    var babelResult = tsResult.js
        .pipe(gulp.dest(`./${tsProject.config.compilerOptions.outDir}`))
        .pipe(plumber())
        .pipe(babel(babelOpts))
        .pipe(sourcemaps.write('./'));
    // @ts-ignore
    return merge(tsResult.dts, babelResult)
        .pipe(plumber())
        .pipe(gulp.dest(`./${tsProject.config.compilerOptions.outDir}`));
};

const fixPaths = paths => {
    let newPaths = {};
    for (const key in paths) {
        newPaths[key] = `./${tsProject.config.compilerOptions.outDir}/${
            paths[key][0]
        }`.replace('/*', '');
    }
    console.log(newPaths);
    return newPaths;
};

/**
 *
 * @param {string} dir
 * @returns {Array<string>}
 */
const walk = function(dir) {
    var results = [];
    var list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            /* Recurse into a subdirectory */
            results = results.concat(walk(file));
        } else {
            /* Is a file */
            results.push(file);
        }
    });
    return results;
};

gulp.task('proto', function(done) {
    const protoFiles = walk('./proto').filter(v => v.endsWith('.proto'));
    pbjs(...protoFiles)
        .then(() => pbts())
        .then(() => done());
});

gulp.task('parcel-library', function(done) {
    parcelBuild('build/index.js', 'node').then(_ => done());
});

gulp.task('parcel-app', function(done) {
    parcelBuild('build/index.js', 'node').then(_ => done());
});

gulp.task('build-app', function() {
    return compile({
        presets: [
            [
                '@babel/preset-env',
                {
                    targets: {
                        node: true,
                    },
                    useBuiltIns: 'entry',
                    debug: true,
                },
            ],
            '@babel/preset-typescript',
        ],
        plugins: [
            [
                'babel-plugin-module-resolver',
                {
                    root: [`./${tsProject.config.compilerOptions.outDir}`],
                    alias: fixPaths(tsProject.config.compilerOptions.paths),
                },
            ],
        ],
    });
});

gulp.task('build-library', function() {
    return compile({
        presets: [
            [
                '@babel/preset-env',
                {
                    targets: {
                        node: true,
                    },
                    useBuiltIns: false,
                    debug: true,
                },
            ],
            '@babel/preset-typescript',
        ],
        plugins: [
            [
                'babel-plugin-module-resolver',
                {
                    root: [`./${tsProject.config.compilerOptions.outDir}`],
                    alias: fixPaths(tsProject.config.compilerOptions.paths),
                },
            ],
            '@babel/plugin-transform-runtime',
            '@babel/plugin-transform-regenerator',
        ],
    });
});

gulp.task('library', gulp.series('build-library', 'parcel-library'));
gulp.task('app', gulp.series('build-app', 'parcel-app'));
gulp.task('default', gulp.series('library'));
