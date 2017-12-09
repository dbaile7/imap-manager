// app/mail.js

var mime = require('mime-lib');
var Imap = require('imap');
var inspect = require('util').inspect;
var config = require('./config/mailserver');

function createImap(email, password) {
    return new Imap({
        user: email,
        password: password,
        host: config.host,
        port: config.port,
        tls: config.tls,
        authTimeout: config.authTimeout,
        connTimeout: config.connTimeout
    });
}

function decodeContent(content, encoding, charset) {
    // Ensure content is a string
    if (!(typeof content === 'string' || content instanceof String)) {
        console.log('decodeContent(' + encoding + ') failed. Content is wrong type: ' + typeof content);
        return '';
    }

    // Verify that a valid string is sent in for encoding
    if (encoding === null || encoding === undefined) {
        console.log('decodeContent() failed. No encoding specified');
        return content;
    }

    // Decode if we know the encoding scheme
    if (encoding === 'base64') {
        content = mime.decodeBase64(content, charset);
        if (typeof content === 'Buffer' || content instanceof Buffer) {
            content = content.toString();
        }
    }
    else if (encoding === 'quoted-printable') {
        content = mime.decodeQP(content);
    }

    return content;
}

function getEmails(email, password, folder, callback) {
    var imap = createImap(email, password);
    
    // When ready, load the list of emails and return it
    imap.once('ready', function() {
        imap.openBox(folder, true, function(err, box) {
            if (err) {
                // TODO test possible error cases and handle
                console.log('getEmails(' + email + ', ' + password + ', ' + folder + ') OPENBOX failed. ' + err);
                callback('Failed to open the folder');
            }
            else {
                // No error, search for emails to fetch
                imap.search([ 'ALL' ], function(err, results) {
                    if (err) {
                        // TODO test possible error cases and handle
                        console.log('getEmails(' + email + ', ' + password + ', ' + folder + ') SEARCH failed. ' + err);
                        callback('Failed to query for emails on the server');
                    }
                    // No results to fetch
                    else if (!results || results.length === 0) {
                        callback(null, []);
                    }
                    else {
                        // Object to hold the emails to return - use a map due to streams being asynchronous
                        var emails = {};

                        // We have the list of emails to fetch
                        var fetch = imap.fetch(results, {
                            bodies: ['TEXT', 'HEADER.FIELDS (FROM TO SUBJECT DATE)'],
                            struct: true
                        });
                        fetch.on('message', function(msg, seqno) {
                            var headerBuffer = '';
                            var textBuffer = '';
                            var attributes = {};
                            
                            // Init this email
                            emails[seqno] = {
                                header: {},
                                attributes: {},
                                content: {}
                            };

                            msg.on('body', function(stream, info) {
                                var count = 0;
                                stream.on('data', function(chunk) {
                                    count += chunk.length;
                                    if (info.which === 'TEXT') {
                                        textBuffer += chunk.toString('utf8');
                                    }
                                    else {
                                        headerBuffer += chunk.toString('utf8');
                                    }
                                });
                                stream.once('end', function() {
                                    if (info.which !== 'TEXT') {
                                        var parsedHeader = Imap.parseHeader(headerBuffer);

                                        // Store the header in our email
                                        emails[seqno].header = parsedHeader;
                                    }
                                });
                            });
                            msg.once('attributes', function(attrs) {
                                attributes = attrs;
                    
                                // Store the attributes in our email
                                emails[seqno].attributes = attributes;
                            });
                            msg.once('end', function() {
                                var content = {
                                    raw: textBuffer
                                };

                                // Ensure attribute struct is set
                                if (!attributes.struct) {
                                    attributes.struct = [];
                                }
                                
                                // Is this a multipart message?
                                if (attributes.struct.length === 1) {
                                    // Not multipart
                                    var struct = attributes.struct[0];
                                    var data = decodeContent(textBuffer, struct.encoding, struct.params.charset);

                                    if (!content[struct.type]) {
                                        content[struct.type] = {};
                                    }
                                    content[struct.type][struct.subtype] = data;
                                }
                                // Multipart
                                else if (attributes.struct.length > 1 ) {
                                    // Need an array to store each part
                                    var parts = [];

                                    // Handle each part
                                    for (var index = 0; index < attributes.struct.length; index++) {
                                        var attribute = attributes.struct[index];

                                        // First part should be an object storing the multipart details
                                        if (!Array.isArray(attribute)) {
                                            // This attribute holds our boundary delimiter
                                            var boundary = '--' + attribute.params.boundary;

                                            // We have a boundary, first split on each line
                                            var lines = textBuffer.split('\r\n');
                                            
                                            // Part string to build each individual part
                                            var part = '';

                                            // Are we reading part header info?
                                            var headerInfo = true;

                                            // Go through the lines and build our part contents
                                            for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                                                var line = lines[lineIndex];
                                                // If this line contains our boundary, start a new part
                                                if (line.indexOf(boundary) !== -1) {
                                                    // If part already exists, we have built one
                                                    if (part != '') {
                                                        parts.push(part);
                                                        part = '';
                                                    }

                                                    // Now reading part header info
                                                    headerInfo = true;
                                                }
                                                // Otherwise we check if this line contains header information
                                                else if (headerInfo) {
                                                    // We don't care about the headers, just when they are done
                                                    if (line === '') {
                                                        headerInfo = false;
                                                    }
                                                }
                                                else {
                                                    // Not the first section for this part, add line endings
                                                    if (part.length > 0) {
                                                        part += '\r\n';
                                                    }
                                                    
                                                    // Add the next part to the string
                                                    part += line;
                                                }
                                            }
                                        }
                                        // Subsequent parts will be arrays containing each part
                                        else {
                                            var currentPart = parts[index - 1];
                                            if (currentPart != null && currentPart != undefined) {

                                                for (var subindex = 0; subindex < attribute.length; subindex++) {
                                                    var struct = attribute[subindex];
                                                    
                                                    // Decode using known decoding mechanisms
                                                    if (struct.partID) {
                                                        currentPart = decodeContent(currentPart, struct.encoding, struct.params.charset);
                                                    }

                                                    // Verify content major type is initialized
                                                    if (!content[struct.type]) {
                                                        content[struct.type] = {};
                                                    }

                                                    // Verify content subtype is initialized
                                                    if (!content[struct.type][struct.subtype]) {
                                                        content[struct.type][struct.subtype] = '';
                                                    }

                                                    // Store in output
                                                    content[struct.type][struct.subtype] += currentPart;
                                                }
                                            }
                                        }
                                    }
                                }

                                // Store the content in our email
                                emails[seqno].content = content;
                            });
                        });
                        fetch.once('error', function(err) {
                            callback('Failed to fetch messages!');
                        });
                        fetch.once('end', function() {
                            imap.end();

                            // Return messages as an array
                            var emailArray = [];
                            for (var key in emails) {
                                emailArray.push(emails[key]);
                            }
                            callback(null, emailArray);
                        });
                    }
                });
            }
        });
    });

    // Handle errors
    imap.once('error', function(err) {
        console.log('getFolders(' + email + ', ' + password + ') failed. ' + err);
        
        if (err.source === 'timeout') {
            callback('Timed out while connecting to the server');
        }
        else {
            callback('An unspecified error has occurred');
        }
    });

    // Start the request
    imap.connect();
}

function getFolders(email, password, callback) {
    var imap = createImap(email, password);

    // When ready, load the list of folders and return it in the callback
    imap.once('ready', function() {
        imap.getBoxes(callback);
    });

    // Handle errors
    imap.once('error', function(err) {
        console.log('getFolders(' + email + ', ' + password + ') failed. ' + err);
        
        if (err.source === 'timeout') {
            callback('Timed out while connecting to the server');
        }
        else {
            callback('An unspecified error has occurred');
        }
    });

    // Start the request
    imap.connect();
}

// Expose mail functions
module.exports = {
    getEmails: getEmails,
    getFolders: getFolders
}