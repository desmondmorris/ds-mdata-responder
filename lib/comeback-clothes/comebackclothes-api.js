/**
 * Controls Comeback Clothes SMS interactions.
 */

var mobilecommons = require('../../mobilecommons/mobilecommons')
    , mongoose = require('mongoose')
    , config = require('./config.json')
    ;

/**
 * Set of Mobile Commons opt-in paths for tips.
 */
var posterTips = exports.posterTips = config.posterTips.optins;

// @todo The same model should be used for tips across all campaigns.
var tipModelName = config.tipModelName;

/**
 * Mongo setup and config.
 */
// Setup Mongo database connection, schemas, and models
var mongoUri = 'mongodb://localhost/ds-mdata-responder-last-tip-delivered';
mongoose.createConnection(mongoUri);

// Mongo Schema
var tipSchema = new mongoose.Schema({
  phone: String,
  last_tip_delivered: [{
    name: String,
    last_tip: Number
  }]
});

var tipModel = mongoose.model(tipModelName, tipSchema);

/**
 * Progress a user through a series of tips delivered via Mobile Commons opt-in paths.
 */
exports.deliverTips = function(request, response, tipName) {

  var tips = posterTips;

  // Find an existing document for a user with the requesting phone number
  tipModel.findOne(
    {phone: request.body.phone},
    function(err, doc) {
      if (err) return console.log(err);

      // An existing doc for this phone number has been found
      if (doc) {

        var lastTip = -1;
        var ltdIndex = -1;

        // Check to see what tip the user received last
        for (var i = 0; i < doc.last_tip_delivered.length; i++) {
          if (doc.last_tip_delivered[i].name === tipName) {
            lastTip = doc.last_tip_delivered[i].last_tip;
            ltdIndex = i;
          }
        }

        // Get index of the last tip delivered
        var tipIndex = -1;
        if (lastTip > 0) {
          tipIndex = tips.indexOf(lastTip);
        }

        // Select next tip
        tipIndex++;

        // If next selected tip is past the end, loop back to the first one
        if (tipIndex >= tips.length) {
          tipIndex = 0;
        }

        // Get the opt-in path for the next tip
        var optin = tips[tipIndex];

        // Update last_tip with the selected opt-in path
        if (ltdIndex >= 0) {
          doc.last_tip_delivered[ltdIndex].last_tip = optin;
        }
        else {
          doc.last_tip_delivered[doc.last_tip_delivered.length] = {
            'name': tipName,
            'last_tip': optin
          };
        }

        // Send the opt-in request to Mobile Commons
        var args = {
          alphaPhone: request.body.phone,
          alphaOptin: optin
        };

        if (request.body.dev !== '1') {
          mobilecommons.optin(args);
        }

        // Update the existing doc in the database
        var data = {
          'phone': request.body.phone,
          'last_tip_delivered': doc.last_tip_delivered
        };

        tipModel.update(
          {phone: request.body.phone},
          data,
          function(err, num, raw) {
            if (err) return console.log(err);

            console.log('Updated %d document(s). Mongo raw response:', num);
            console.log(raw);
            console.log("\n\n");
          }
        );
      }
      // An existing doc for this phone was not found
      else {
        // Select the first opt in path in the array
        var optin = tips[0];
        var args = {
          alphaPhone: request.body.phone,
          alphaOptin: optin
        };

        if (request.body.dev !== '1') {
          mobilecommons.optin(args);
        }

        // Create a new doc
        var model = new tipModel({
          'phone': request.body.phone,
          'last_tip_delivered': [{
            'name': tipName,
            'last_tip': optin
          }]
        });

        // Save the doc to the database
        model.save(function(err) {
          if (err) return console.log(err);

          return console.log("Save successful.\n\n");
        });

        console.log('Saving new model: ' + model);
      }
    }
  );

  response.send();

}