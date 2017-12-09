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

Now we can start managing our imap account!
