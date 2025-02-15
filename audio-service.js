var compression = require("compression");
var bodyParser = require('body-parser');
var errorHandler = require('errorhandler');
var https = require('https');
var config = require("config");
var audio = require("./lib/audio");
var exec = require('child_process').exec;
var morgan = require("morgan");
var shellPromises = require("./lib/shellPromises");
var path = require('path');
var fs = require('fs');
var express = require('express');
var cors = require('cors');
var serveIndex = require('serve-index');

var app = express();

var serviceVersion = require("./package.json").version;
var multipartMiddleware = require("./middleware/multipartParser");
/*
 * Cross Origin Resource Sharing (CORS) Configuration, needed for for all HTML5
 * clients running on any domain to contact this webservice.
 */

//var corsOptions = {
//  origin : "*",
//  methods : "GET,PUT,POST"
//};
try {
  fs.mkdirSync(config.audioVideoRawDir, function(data) {
    console.log("mkdir callback " + data);
  });
} catch (e) {
  if ([47, -17].includes(e.errno0)) {
    console.log(e.errno, e);
  } else {
    console.log("Dir was already ready.");
  }
}
try {
  fs.mkdirSync(config.audioVideoByCorpusDir, function(data) {
    console.log("mkdir callback " + data);
  });
} catch (e) {
  if ([47, -17].includes(e.errno0)) {
    console.log(e.errno, e);
  } else {
    console.log("Dir was already ready.");
  }
}

// app.use(cors({ origin: "chrome-extension://hdfkfcibgbjomikilhmkdpkcfpecakhd" }));
app.use(cors());
// app.use(app.router);
app.use(compression())
app.use(morgan("combined"));
app.use(bodyParser.json());
app.use('/utterances', express.static(__dirname + '/bycorpus'));
app.use('/utterances', express.static(__dirname + '/bycorpus'), serveIndex(__dirname + '/bycorpus', {
  icons: true,
  template: 'public/directory.html',
}));
app.use(errorHandler({
  dumpExceptions: true,
  showStack: true
}));

app.get('/robots.txt', function(req, res){
  res.type('text/plain');
  res.send("User-agent: *\nDisallow: /");
});
app.post('/upload/extract/utterances', multipartMiddleware, function(req, res) {
  var audioVideoFiles = [],
    dbname,
    token,
    textGridCommand,
    returnJSON;

  token = req.body.token;
  if (!token || !token.trim()) {
    res.statusCode = 403;
    returnJSON = {
      status: 403,
      userFriendlyErrors: ["Forbidden you are not permitted to upload files."]
    };
    console.log(returnJSON);
    return res.send(returnJSON);
  }

  username = req.body.username;
  if (!username || !username.trim()) {
    res.statusCode = 403;
    returnJSON = {
      status: 403,
      userFriendlyErrors: ["Forbidden you are not permitted to upload files."]
    };
    console.log(returnJSON);
    return res.send(returnJSON);
  }

  dbname = req.body.dbname || req.body.pouchname || req.body.corpusidentifier;
  if (!dbname || !dbname.trim()) {
    res.statusCode = 422;
    returnJSON = {
      status: 422,
      userFriendlyErrors: ["No database was specified, upload cannot be processed."]
    };
    console.log(returnJSON);
    return res.send(returnJSON);
  }


  if (req.files && req.files.videoFile) {
    audioVideoFiles.push(req.files.videoFile);
  } else if (req.files && req.files.files && req.files.files.length > 0) {
    audioVideoFiles = req.files.files;
    // console.log(audioVideoFiles);
  } else if (req.files && req.files[0]) {
    for (var fileIndex in req.files) {
      audioVideoFiles.push(req.files[fileIndex]);
    }
    // console.log(audioVideoFiles);
  } else if (req.files && req.files['files[]']) {
    for (var fileIndex in req.files) {
      audioVideoFiles.push(req.files[fileIndex]);
    }
  } else {
    res.statusCode = 422;
    returnJSON = {
      status: 422,
      userFriendlyErrors: ["No files were attached."]
    };
    console.log(returnJSON);
    return res.send(returnJSON);
  }

  console.log(new Date() + " Generating textgrids ");
  audio.createAudioFromUpload(audioVideoFiles, dbname, config.audioVideoRawDir, config.audioVideoByCorpusDir)
    .then(function(result) {
        console.log(new Date() + " Completed.");
        // console.log(result);
        for (var resultFileIndex = 0; resultFileIndex < result.length; resultFileIndex++) {
          delete result[resultFileIndex].path;
          delete result[resultFileIndex].currentWorkingDir;
          delete result[resultFileIndex].uploadFileId;
          result[resultFileIndex].serviceVersion = serviceVersion;
        }

        audioVideoFiles = result;
      },
      function(reason) {
        console.log(new Date() + " Error");
        audioVideoFiles = {
          status: 500,
          reason: reason
        };
        console.log(reason);
      })
    .fin(function() {
      returnJSON = {
        status: 200,
        files: audioVideoFiles
      };
      console.log(returnJSON);
      res.send(returnJSON);
    });
});


app.post('/upload', function(req, res) {

  console.log('Got to my upload API');
  console.log(req.body);

  var filesToUpload = req.files.filesToUpload[0];
  var fs = require('fs.extra');
  var p1 = '../storage/audio/';
  var p2 = '../storage/dictionaries/';
  var p3 = '../Prosodylab-Aligner/tmp/';
  var p4 = '../Prosodylab-Aligner/';

  console.log(req.files);
  var currentFileName = "audiofilename";
  for (var i in filesToUpload) {

    (function(index) {
      var a = filesToUpload[index];
      switch (a.type) {
        case 'audio/wav':
          fs.copy(a.path, p1 + a.name, function(error) {
            if (error) {
              throw error;
            }
            console.log('Successfully copied ' + a.name + ' to ' + p1);
            fs.copy(a.path, p3 + a.name, function(error) {
              if (error) {
                throw error;
              }
              console.log('Successfully copied ' + a.name + ' to ' + p3);
              fs.unlink(a.path,
                function(error) {
                  if (error) {
                    throw error;
                  }
                  console.log('Successfully removed ' + a.name + ' from ' + a.path);
                });
            });
          });
          break;
        case 'audio/mp3':
          fs.copy(a.path, p1 + a.name, function(error) {
            if (error) {
              throw error;
            }
            console.log('Successfully copied ' + a.name + ' to ' + p1);
            fs.copy(a.path, p3 + a.name, function(error) {
              if (error) {
                throw error;
              }
              console.log('Successfully copied ' + a.name + ' to ' + p3);
              fs.unlink(a.path,
                function(error) {
                  if (error) {
                    throw error;
                  }
                  console.log('Successfully removed ' + a.name + ' from ' + a.path);
                });
            });
          });
          break;
        case 'text/plain':
          fs.copy(a.path, p2 + a.name, function(error) {
            if (error) {
              throw error;
            }
            console.log('Successfully copied ' + a.name + ' to ' + p2);
            fs.copy(a.path, p3 + a.name, function(error) {
              if (error) {
                throw error;
              }
              console.log('Successfully copied ' + a.name + ' to ' + p3);
              fs.unlink(a.path,
                function(error) {
                  if (error) {
                    throw error;
                  }
                  console.log('Successfully removed ' + a.name + ' from ' + a.path);
                });
            });
          });
          break;
        case 'application/octet-stream':
          console.log(a);
          fs.rename(a.path, p3 + a.name, function(error) {
            if (error) {
              throw error;
            }
            console.log('Successfully copied ' + a.name + ' to ' + p3);
            console.log('Successfully removed ' + a.name + ' from ' + a.path);
          });
          break;
      }
    })(i);
  }

  try {
    currentFileName = filesToUpload[0].name.substring(0, filesToUpload[0].name.lastIndexOf("."));
  } catch (e) {
    console.loge(e);
  }
  var command = 'cd $FIELDDB_HOME/' + 'Prosodylab-Aligner && ./align.py -t ./tmp -d ./tmp/dictionary.txt ./tmp';
  var child = exec(command, function(err, stdout, stderr) {
    if (err)
      throw err;
    else {
      console.log('generated textgrid');
      var p = path.resolve('../Prosodylab-Aligner/tmp/' + currentFileName + '.TextGrid');
      res.download(p, currentFileName + '.TextGrid');
    }
  });

});

app.post('/textgrids', function(req, res) {

  console.log('got to my textgrid API');
  console.log(req.body);

  /*
   * TODO check to see if the text grids on couchdb are built with these
   * materials? YES: return the textgrids NO: run it again
   */
  res.send({
    'textGrids': [{
      corpus: {},
      filename: 'test_audio.wav',
      textGrid: 'hi'
    }, {
      corpus: {},
      filename: 'test_audio2.wav',
      textGrid: 'hi'
    }]
  });

});

app.post('/progress', function(req, res) {
  res.send('50');
  console.log('got to my progress API');

});


app.get('/videofilenames', function(req, res) {

  console.log('got to the videofilenames API');
  var dir = 'utterances/'; // your directory

  // var files = fs.readdirSync(dir);
  // files.sort(function(a, b) {
  //   return fs.statSync(dir + a).mtime.getTime() -
  //     fs.statSync(dir + b).mtime.getTime();
  // });
  /* cached version */
  var files = fs.readdirSync(dir)
    .map(function(v) {
      return {
        name: v,
        time: fs.statSync(dir + v).mtime.getTime()
      };
    })
    .sort(function(a, b) {
      return a.time - b.time;
    })
    .map(function(v) {
      return v.name;
    });
  console.log(files);
  res.send(files);
});


app.get('/:dbname/:filename', function(req, response) {
  var dbname = req.params.dbname;
  if (!dbname || !dbname.trim() || dbname.indexOf(/[^a-zA-Z0-9_-]/) > -1) {
    response.statusCode = 422;
    returnJSON = {
      status: 422,
      userFriendlyErrors: ["No database was specified, request cannot be processed."]
    };
    console.log(returnJSON);
    return response.send(returnJSON);
  }

  var filename = req.params.filename;
  if (!filename || !filename.trim() || filename.indexOf(/\//) > -1) {
    response.statusCode = 422;
    returnJSON = {
      status: 422,
      userFriendlyErrors: ["No filename was specified, request cannot be processed."]
    };
    console.log(returnJSON);
    return response.send(returnJSON);
  }

  var fileBaseName = filename.substring(0, filename.lastIndexOf("."));
  var fileWithPath = config.audioVideoByCorpusDir + "/" + dbname + "/" + fileBaseName + "/" + filename;
  console.log(fileWithPath);
  if (fs.existsSync(fileWithPath)) {
    response.sendfile(fileWithPath);
  } else {
    response.statusCode = 404;
    returnJSON = {
      status: response.statusCode,
      userFriendlyErrors: ["Not found"]
    };
    console.log(returnJSON);
    return response.send(returnJSON);
  }
});

if (!module.parent) {
  /*
   * HTTPS Configuration, needed for for all HTML5 chrome app clients to contact
   * this webservice. As well as a general security measure.
   */
  if (process.env.NODE_ENV === "production") {
    app.listen(config.httpsOptions.port);
  } else {
    https.createServer(config.httpsOptions, app).listen(config.httpsOptions.port);
  }
  console.log('AudioWebService v' + serviceVersion + ' listening on port ' + config.httpsOptions.port);
}

module.exports = app;
