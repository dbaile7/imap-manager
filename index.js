// app/mail.js

var mime = require('mime-lib');
var Imap = require('imap');
var inspect = require('util').inspect;

// Our default configuration
var config = {
    port: 993,
    tls: true
}

// Expose mail functions
module.exports = function(userconfig) {

    // Add user config to overwrite config
    for (var property in userconfig) {
        if (userconfig.hasOwnProperty(property)) {
            config[property] = userconfig[property];
        }
    }

    // Expose our functions
    return {
        getEmails: getEmails,
        getFolders: getFolders
    };
};


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

function decodeContent(content, struct) {
    // Decoding vars
    var encoding = struct.encoding ? struct.encoding : null;
    var charset = struct.params && struct.params.charset ? struct.params.charset : null;

    // Ensure content is a string
    if (!(typeof content === 'string' || content instanceof String)) {
        console.log('decodeContent(' + encoding + ') failed. Content is wrong type: ' + typeof content);
        return '';
    }

    // Only text-types are decoded before returning to the client
    if (struct.type !== 'text') {
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

function parseContent(rawData, attributes) {
    // Format our content object
    var content = {
        raw: rawData,
        attachments: []
    };

    // Ensure attribute struct is set
    if (!attributes.struct) {
        attributes.struct = [];
    }
    
    // Prepare to parse the entirity of the email
    prepareParse(attributes.struct, rawData, content);

    // Return the constructed content object
    return content;
}

/*
    Determines if a struct contains multiple parts/subparts and
    decodes it accordingly.
*/
function prepareParse(struct, data, content) {
    // Is this a multipart message?
    if (struct.length === 1) {

        // Not multipart
        storeContent(data, struct[0], content);
    }
    // Multipart
    else if (struct.length > 1 ) {

        // Start the semi-recursive parse
        parsePartial(struct, data, content);
    }
}

/*
    Stores content in the output object
*/
function storeContent(data, struct, content) {
            
    var decodedData = decodeContent(data, struct);

    // Text content is stored directly into the content object
    if (struct.type === 'text') {

        // Initialize this type/subtype
        if (!content[struct.type]) {
            content[struct.type] = {};
        }
        if (!content[struct.type][struct.subtype]) {
            content[struct.type][struct.subtype] = '';
        }

        content[struct.type][struct.subtype] += decodedData;
    }
    // All other content is stored in attachments
    else {

        // Want a deep copy of this struct (as-is)
        var attachment = JSON.parse(JSON.stringify(struct));
        attachment.data = decodeContent(data, struct);

        // Some attachment ids are wrapped in angle brackets
        if (attachment.id) {
            if (attachment.id[0] ==='<' && attachment.id[attachment.id.length - 1] === '>') {
                attachment.id = attachment.id.substr(1, attachment.id.length - 2);
            }
        }

        // Store in our attachments list
        content.attachments.push(attachment);
    }
}

/*
    Takes a struct containing attributes about the content to parse
    and parses the input data accordingly. It is then outputted to
    the content map.
*/
function parsePartial(struct, data, content) {
    // Need an array to store each part
    var parts = [];

    // Handle each part
    for (var index = 0; index < struct.length; index++) {
        var attribute = struct[index];

        // First part should be an object storing the multipart details
        if (!Array.isArray(attribute)) {
            // This attribute holds our boundary delimiter
            var boundary = '--' + attribute.params.boundary;

            // We have a boundary, first split on each line
            var lines = data.split('\r\n');
            
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

                // If there are multiple sub-structs, we see if another partial-parse is requried
                if (attribute.length > 1 && !Array.isArray(attribute[0])) {
                    parsePartial(attribute, currentPart, content);
                }
                // Just parse this array as-is, no more partials
                else {
                    for (var subindex = 0; subindex < attribute.length; subindex++) {
                        var substruct = attribute[subindex];
    
                        // Verify we have the necessary details to store the content
                        if (substruct.type && substruct.subtype) {

                            // Store it
                            storeContent(currentPart, substruct, content);
                        }
                    }
                }
            }
        }
    }
}

/**
 * Returns an array of all emails in the specified folder
 * @param {string} email - The email address of the user to authenticate
 * @param {string} password - The password for the email address provided
 * @param {folder} folder - The name of the folder you wish to load emails from
 * @param {function} callback - An optional callback to use when a result is ready (format: function(err, emails))
 */
function getEmails(email, password, folder, callback) {
    return new Promise((resolve, reject) => {
        var imap = createImap(email, password);
        
        // When ready, load the list of emails and return it
        imap.once('ready', function() {
            imap.openBox(folder, true, function(err, box) {
                if (err) {
                    var message = 'Failed to open the folder';
                    if (callback) {
                        return callback(message);
                    }
                    else {
                        return reject(message);
                    }
                }
                else {
                    // No error, search for emails to fetch
                    imap.search([ 'ALL' ], function(err, results) {
                        if (err) {
                            var message = 'Failed to query for emails on the server';
                            if (callback) {
                                return callback(message);
                            }
                            else {
                                return reject(message);
                            }
                        }
                        // No results to fetch
                        else if (!results || results.length === 0) {
                            if (callback) {
                                return callback(null, []);
                            }
                            else {
                                return resolve([]);
                            }
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
                                    // Store the content in our email
                                    emails[seqno].content = parseContent(textBuffer, attributes);
                                });
                            });
                            fetch.once('error', function(err) {
                                var message = 'Failed to fetch messages!';
                                if (callback) {
                                    return callback(message);
                                }
                                else {
                                    return reject(message);
                                }
                            });
                            fetch.once('end', function() {
                                imap.end();

                                // Return messages as an array
                                var emailArray = [];
                                for (var key in emails) {
                                    emailArray.push(emails[key]);
                                }
                                
                                if (callback) {
                                    callback(null, emailArray);
                                }
                                else {
                                    return resolve(emailArray);
                                }
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
    });
}

/**
 * Returns an object containing a property for each folder
 * @param {string} email - The email address of the user to authenticate
 * @param {string} password - The password for the email address provided
 * @param {function} callback - An optional callback to use when a result is ready (format: function(err, folders))
 */
function getFolders(email, password, callback) {
    return new Promise((resolve, reject) => {
        
        var imap = createImap(email, password);

        // When ready, load the list of folders and return it in the callback
        imap.once('ready', function() {
            imap.getBoxes(function(err, result) {
                if (callback) {
                    return callback(err, result);
                }
                else if (err) {
                    return reject(err);
                }
                else {
                    // Since folders may have children (With parent references), we remove the parent references (Circular dependencies)
                    _removeParents(result);

                    // Now we return the result
                    return resolve(result);
                }

                // Helper function to remove parent references from a mailbox
                function _removeParents(mailbox) {
                    Object.keys(mailbox).forEach(function(key) {
                        var box = mailbox[key];
                        delete box.parent;

                        // Recursively remove children's parent references
                        if (box.children) {
                            _removeParents(box.children);
                        }
                    });
                }
            });
        });

        // Handle errors
        imap.once('error', function(err) {

            // Format an error message
            var message = 'An unspecified error has occurred';

            if (err.source === 'timeout') {
                message = 'Timed out while connecting to the server';
            }

            if (callback) {
                return callback(message);
            }
            else {
                return reject(message);
            }
        });

        // Start the request
        imap.connect();
    });
}
