var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var mime = require('mime')

function readRangeHeader(range, totalLength) {
  /*
   * Input: bytes=100-200
   * Output: ["", "100", "200", ""]
   *
   * Input: bytes=100-
   * Output: ["", "100", "200", ""]
   *
   * Input: bytes=-200
   * Output: ["", "", "200", ""]
   */

  if (range == null || range.length == 0)
    return null;

  var array = range.split(/bytes=([0-9]*)-([0-9]*)/);
  var start = parseInt(array[1]);
  var end = parseInt(array[2]);
  var result = {
    start: isNaN(start) ? 0 : start,
    end: isNaN(end) ? (totalLength - 1) : end
  };

  if (!isNaN(start) && isNaN(end)) {
    result.start = start;
    result.end = totalLength - 1;
  }

  if (isNaN(start) && !isNaN(end)) {
    result.start = totalLength - end;
    result.end = totalLength - 1;
  }

  return result;
}

router.get('/:filename', function(req, res, next) {
  var filename = req.params.filename ? req.params.filename.trim() : '';
  if (filename) {
    var filepath = path.join(__dirname, '../avs/', filename);
    fs.stat(filepath, function(err, stats) {
      if (err) {
        return next(err);
      }
      var fileSize = stats.size;
      if (stats.isFile()) {
        var rangeRequest = readRangeHeader(req.headers['range'], fileSize);
        if (rangeRequest == null) {
          res.set({
            'Content-Type': mime.lookup(filename),
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes'
          });
          res.status(200);
          var readable = fs.createReadStream(filepath);
          readable.on('open', function() {
            readable.pipe(res);
          });
        } else {
          var start = rangeRequest.start;
          var end = rangeRequest.end;

          if (start >= fileSize || end >= fileSize) {
            res.set('Content-Range', 'bytes */' + fileSize);
            res.status(416).end();  // Range Not Satisfiable
          } else {
            res.set({
              'Content-Range': 'bytes ' + start + '-' + end + '/' + fileSize,
              'Content-Length': start == end ? 0 : (end - start + 1),
              'Content-Type': mime.lookup(filename),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'no-cache'
            });
            res.status(206); // Partial Content
            var readable = fs.createReadStream(filepath, {start: start, end: end});
            readable.on('open', function() {
              readable.pipe(res);
            });
          }
        }
      } else {
        next();
      }
    });
  }

});

module.exports = router;
