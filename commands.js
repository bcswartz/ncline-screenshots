//Load needed core Node modules
var fs = require( 'fs' );
var os = require( 'os' );

//Load NPM modules
var _ = require( 'lodash' );
var chokidar = require('chokidar');

//Load needed library files
var output = require( '../../../lib/output' );
var core = require( '../../../lib/core' );
var watchers = require( '../../../lib/watchers' );

//Load init module used to create/load existing configuration and usage data
var init = require( './init' );

init.execute();

var data = init.getData();
var dataFile = init.getConfig().dataFile;

var watcher;

var privateMethods = {
    getTimestampValues: function( fileObj, statTime ) {
        var timestamp = statTime ? statTime : 'birthtime';
        return {
            year: fileObj.stats[ timestamp ].getFullYear(),
            month: _.padStart('' + ( fileObj.stats[ timestamp ].getMonth() + 1 ), 2, '0'),
            day: _.padStart('' + fileObj.stats[ timestamp ].getDate(), 2, '0'),
            hours: _.padStart( fileObj.stats[ timestamp ].getHours(), 2, '0' ),
            minutes:  _.padStart( fileObj.stats[ timestamp ].getMinutes(), 2, '0' ),
            seconds: _.padStart( fileObj.stats[ timestamp ].getSeconds(), 2, '0' )
        }
    },

    getFilePrefix: function() {
        return data.filePrefix != "" ? data.filePrefix : data.defaultPrefix;
    },
    
    performRename: function( oldPath, newPath, newFilename, fileObj ) {
        try {
            fs.renameSync( oldPath, newPath );
            //TODO: consider support for toast confirmation of successful rule execution
            fileObj.filePath = newPath;
            fileObj.fileName = newFilename;
        } catch( err ) {
            output.passError( err );
            fileObj.rule.continue = false;
        }
        
        return fileObj;
    },

    checkForRule: function( ruleName ) {
        var ruleIndex = _.findIndex( data.rules, function( rule ) { return rule.name == ruleName } );
        if( ruleIndex == -1 ) {
            output.throwError( "No rule with the name '" + ruleName + "' exists." );
        } else {
            return ruleIndex;
        }
    }
};


var actions = {

    createdTimeName: function( fileObj ) {
        
        var timestamp = privateMethods.getTimestampValues( fileObj );
        var newFileName = privateMethods.getFilePrefix() + '-'
            + timestamp.hours + '-'
            + timestamp.minutes + '-'
            + timestamp.seconds + '.'
            + fileObj.fileExtension;

        var newFilePath = _.replace( fileObj.filePath, fileObj.fileName, newFileName);

        return privateMethods.performRename( fileObj.filePath, newFilePath, newFileName, fileObj );
        
    },

    fileByDate: function( fileObj ) {

        var timestamp = privateMethods.getTimestampValues( fileObj );
        var dateDirectory = timestamp.year + '-'
            + timestamp.month + '-'
            + timestamp.day ;

        var targetDirectory = data.creationDirectory + '/' + dateDirectory;
        try{
            fs.statSync( targetDirectory );
        } catch( err ) {
            fs.mkdirSync( targetDirectory );
        }
        
        var newFilePath = _.replace( fileObj.filePath, fileObj.fileName, dateDirectory + '/' + fileObj.fileName );

        return privateMethods.performRename( fileObj.filePath, newFilePath, fileObj.fileName, fileObj );
        
    }
    
};

//Set watcher
if( data.creationDirectory !=  '' ) {
    try{
        fs.statSync( data.creationDirectory );
        watcher = chokidar.watch( data.creationDirectory, {
            ignored: /[\/\\]\./,
            persistent: true,
            depth: 0,
            alwaysStat: true,
            //Give whatever OS or program that manages screenshot creation time to finish and relinquish the file.
            //May need higher interval values depending on the OS/program.
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        });

        watcher.on('add', function ( filePath, fileStats ) {

            //The comparison between the added filePath and the previousAddResult prevents the add event triggered
            //by adding a subdirectory from firing
            if( data.active && fileStats && fileStats.isFile() && filePath != data.previousAddResult ) {
                
                var _fileName = os.platform() == 'win32' ? _.last( filePath.split( '\\' ) ) : _.last( filePath.split( '/' ) );

                var fileObj = {
                    filePath: filePath,
                    fileName: _fileName,
                    fileExtension: _.last( _fileName.split( '.' ) ),
                    stats: fileStats
                };

                var continueProcessing = true;
                
                data.rules.forEach( function( rule ) {

                    if( rule.active && continueProcessing != false ) {
                        fileObj.rule = rule;
                        fileObj = actions[ rule.action ].call( this, fileObj );
                        continueProcessing = fileObj.rule.continue;
                    }

                });
                
                data.previousAddResult = fileObj.filePath;
            } 

        });

        watchers.registerWatcher( watcher );

    } catch( err ) {
        output.throwError( 'No screenshot directory has been specified' );
    }
}



module.exports = {
    
    commands: {

        setSSWatchVerbose: function ( setting ) {
            if ( setting == null || !core.isBoolean( setting ) ) {
                output.throwError( "You must provide a string representing a Boolean value (true/false, yes/no, or y/n)" );
            }

            data.verbose = core.booleanValue( setting );

            fs.writeFile( dataFile, JSON.stringify( data, null, 2 ), function ( err ) {
                output.passError( err );
            } );
        },
        
        setSSPath: function( path ) {
            if( path == null ) {
                output.throwError( "You must provide an absolute file path." );
            }

            try{
                fs.statSync( path );
            } catch( err ) {
                output.throwError( "The absolute path '" + path + "' does not exist." );
            }

            var previousDirectory = data.creationDirectory;

            data.creationDirectory = path;

            fs.writeFile( dataFile, JSON.stringify( data, null, 2 ), function ( err ) {
                output.passError( err );
                if ( !err && core.booleanValue( data.verbose ) ) {
                    output.success( "Screenshot path is now '" + path + "'." );
                    if( previousDirectory == '' ) {
                        output.success( "You will need to restart ncline for this change to take effect." );
                    }
                }
            } );

            if( previousDirectory != '' ) {
                watcher.unwatch( previousDirectory );
                watcher.add( data.creationDirectory );
            }
        },

        setSSWatchActive: function ( setting ) {
            if ( setting == null || !core.isBoolean( setting ) ) {
                output.throwError( "You must provide a string representing a Boolean value (true/false, yes/no, or y/n)" );
            }

            data.active = core.booleanValue( setting );

            fs.writeFile( dataFile, JSON.stringify( data, null, 2 ), function ( err ) {
                output.passError( err );
                if ( !err && core.booleanValue( data.verbose ) ) {
                    var watcherState = data.active ? "active" : "inactive";
                    output.success( "Screenshot watcher is " + watcherState );
                }
            } );
        },


        setSSRuleActive: function ( ruleName, setting ) {
            if( ruleName == null || setting == null ) {
                output.throwError( "The rule name and the active/inactive state must be defined" );
            } else if ( !core.isBoolean( setting ) ) {
                output.throwError( "The active/inactive state must be a string representing a Boolean value (true/false, yes/no, or y/n)" );
            }

            var ruleIndex = privateMethods.checkForRule( ruleName );

            data.rules[ ruleIndex ].active = core.booleanValue( setting );

            fs.writeFile( dataFile, JSON.stringify( data, null, 2 ), function ( err ) {
                output.passError( err );
                if ( !err && core.booleanValue( data.verbose ) ) {
                    var ruleState = data.rules[ ruleIndex ].active ? "active" : "inactive";
                    output.success( "Screenshot rule '" + ruleName + "' is now " + ruleState );
                }
            } );
        },


        setSSRuleContinueProcessing: function ( ruleName, setting ) {
            if( ruleName == null || setting == null ) {
                output.throwError( "The rule name and the active/inactive state must be defined" );
            } else if ( !core.isBoolean( setting ) ) {
                output.throwError( "The continue processing flag must be a string representing a Boolean value (true/false, yes/no, or y/n)" );
            }

            var ruleIndex = privateMethods.checkForRule( ruleName );
            
            data.rules[ ruleIndex ].continue = core.booleanValue( setting );

            fs.writeFile( dataFile, JSON.stringify( data, null, 2 ), function ( err ) {
                output.passError( err );
                if ( !err && core.booleanValue( data.verbose ) ) {
                    var ruleState = data.rules[ ruleIndex ].continue ? "allow remaining rules to execute" : "prevent execution of remaining rules";
                    output.success( "Screenshot rule '" + ruleName + "' will now " + ruleState );
                }
            } );
        },


        setSSFilePrefix: function( filePrefix ) {
            if( filePrefix == null ) {
                output.throwError( "You must provide a file-system acceptable string for the start of the screenshot filenames" );
            }

            data.filePrefix = filePrefix;

            fs.writeFile( dataFile, JSON.stringify( data, null, 2 ), function ( err ) {
                output.passError( err );
                if ( !err && core.booleanValue( data.verbose ) ) {
                    output.success( "Screenshot file prefix set to '" + filePrefix + "'." );
                }
            } );
        },

        useSSPrefixDefault: function() {
            
            data.filePrefix = "";

            fs.writeFile( dataFile, JSON.stringify( data, null, 2 ), function ( err ) {
                output.passError( err );
                if ( !err && core.booleanValue( data.verbose ) ) {
                    output.success( "Screenshot file prefix set to default of '" + data.defaultPrefix + "'." );
                }
            } );
        }
        
    }

};