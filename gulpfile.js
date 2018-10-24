'use strict';

var gulp = require('gulp');
var ts = require('gulp-typescript');
var tsProject = ts.createProject('tsconfig.json');
var babel = require('gulp-babel');
var sourcemaps = require('gulp-sourcemaps');
var merge = require('merge-stream');
var plumber = require('gulp-plumber');

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

const compile = babelOpts => {
    var tsResult = tsProject
        .src()
        .pipe(plumber())
        .pipe(sourcemaps.init())
        .pipe(tsProject());
    var babelResult = tsResult.js
        .pipe(plumber())
        .pipe(babel(babelOpts))
        .pipe(sourcemaps.write('./'));
    // @ts-ignore
    return merge(tsResult.dts, babelResult)
        .pipe(plumber())
        .pipe(gulp.dest(`./${tsProject.config.compilerOptions.outDir}`));
};

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
            '@babel/plugin-transform-runtime',
            '@babel/plugin-transform-regenerator',
        ],
    });
});

gulp.task('library', gulp.series('build-library', 'parcel-library'));
gulp.task('app', gulp.series('build-app', 'parcel-app'));
gulp.task('default', gulp.series('app'));
