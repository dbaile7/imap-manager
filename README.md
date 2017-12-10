# imap-manager
Node Module to manage an IMAP server

### Using the package
To start using the package you will need to provide a server configuration to connect to and then require the package:

```js
// Create a configuration object
var config = {
    host: 'imap.gmail.com',
    port: 993, // This is the default
    tls: true, // This is the default
    authTimeout: 10000,
    connTimeout: 20000
};

// Create our manager
var mailserver = require('imap-manager')(config);
```

Now we can start managing our imap server!

### Examples
(These examples assume you have done the above setup)

#### Get all Folders
To get a list of all folders for an imap account perform the following steps:

```js
mailserver.getFolders('email@example.com', 'pa$$word1', function(err, result) {
    if (err) {
        console.log('The following error occurred: ' + err);
    }
    else {
        console.log('Folders: ' + result);
    }
});

// Result
{
    Archive: [Object],
    Draftts: [Object],
    INBOX: [Object],
    ...
}
```

#### List of Emails
To list off all of the emails in a specific folder, you can use *getEmails*:

```js
mailserver.getEmails('email@example.com', 'pa$$word1', 'Inbox', function(err, result) {
	if (err) {
		console.log('The following error occurred: ' + err);
	}
	else {
		console.log('Emails: ' + result);
	}
});

// Result
[
    // Example email
    {
        attributes: {
            date: 'Sat, 02 Dec 2017 22:40:56 -0500',
            flags: [
                '\Seen'
            ],
            ...
        },
        content: {
            raw: ..., // Raw may be deprecated in the future to reduce network usage
            text: {
                plain: 'Example email content',
                html: '<strong>Example</strong> email content'
            }
        },
        header: {
            date: ['Sat, 02 Dec 2017 22:40:56 -0500'],
            from: ['sender@example.com'],
            subject: ['Example Email'],
            to: ['email@example.com']
        }
    },
    ...
]
```
