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
Here are two examples. The callback and promise versions of them are provided - depending on how your asynchronous coding style is you may use either.
(These examples assume you have done the above setup)

#### Get all Folders
To get a list of all folders for an imap account perform the following steps:

```js
// getFolders using a callback
mailserver.getFolders('email@example.com', 'pa$$word1', function(err, result) {
    if (err) {
        console.log('The following error occurred: ' + err);
    }
    else {
        console.log('Folders: ' + JSON.stringify(result));
    }
});

// getFolders using a promise
mailserver.getFolders('email@example.com', 'pa$$word1').then(result => {
    console.log('Folders: ' + JSON.stringify(result);
}).catch(error => {
    console.log('The following error occurred: ' + err);
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
// getEmails using a callback
mailserver.getEmails('email@example.com', 'pa$$word1', 'Inbox', function(err, result) {
    if (err) {
        console.log('The following error occurred: ' + err);
    }
    else {
        console.log('Emails: ' + JSON.stringify(result));
    }
});

// getEmails using a promise
mailserver.getEmails('email@example.com', 'pa$$word1', 'Inbox').then(result => {
    console.log('Emails: ' + JSON.stringify(result));
}).catch(error => {
    console.log('The following error occurred: ' + err);
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
            },
            attachments: [
                {
                    partID: '2',
                    type: 'image',
                    subtype: 'png',
                    encoding: 'base64',
                    data: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACx%0Ajwv8YQUAAAAJcEhZcwAADsQAAA7EAZUrDhsAAAHKSURBVDhPpZO/axNhHIefa/ODXLxe2rRNYmLP%0AHFYoZFAQdHQRB0tdXDo6WBeLqODgJtKlIoUO/RNcVIogig7qIIolQYSKBNO0RIXYltJG0ySXH69v%0AvDM1tIKYB15uuOf7ed/P8Z4iJHRAl/P8bzoO2LPCs0cPSS285dSZMVY+pUm/T1JpKIyfn2AkkXAs%0Am10BqVSS21cu4PH5CPVqbFQUtjY3OTDQw7e6n7sP5h3TZleFm5MTnDxxhENxA78epPijgCW3UPfJ%0AgMwiy0sZx7RpC5ibucPxhEmwN0C90aBP7WLbqiKqFRY+ZKh1e5ieuuXYNm0VTh8dZiAUQvOrJNMr%0AhPt0wgFZ43sRq1bD5fLy6vUbvhQqeL2eXzOtE2SzWfJr6xRKFp/zq3KtcXAwQL+u4nZ1E9Q13qWX%0AMOLx1nCTVoBpmoyeG8cql/BJ4dhhg4+5VbL5DdxutxQFsaDG6NhZZ8KmrcLLF8+ZvTGJR5PfoN6g%0AKo/9dX0LRVEoli0U6Sxmlm35N82AP7l+7aoI9/jEyFBExAb7hRmLCHN/SER0VeRyOcfaYc+L1OTp%0Ak8fM379HubTNkGFw8dJlotGo83aHvwb8Kx3/Cx0GwE9hjclg65ielwAAAABJRU5ErkJggg==',
                    ...
                }
            ]
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
