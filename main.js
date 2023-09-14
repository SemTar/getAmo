const express = require("express");
let app = express();

const dotenv = require('dotenv');
dotenv.config();

let refreshToken;
let accessToken;
let currentDate  = Date.now();
let whenExpires;

app.get("/newLead", async function(request, response){
    if (Date.now() > whenExpires) {
        let result = await fetchGetTokens({
            "refresh_token": refreshToken,
            "grant_type": "refresh_token",
        })
        checkingResultTokens(result);
    }


    let phoneNumber = request.query.phoneNumber;
    let email = request.query.email;
    let name = request.query.name;

    let resultWithPhone = await fetchGetContact(phoneNumber);
    let resultWithEmail = await fetchGetContact(email);

    if (!resultWithPhone && !resultWithEmail) {
        try {
            let result = await fetchNewContact(name, email, phoneNumber);
            let contactID = result._embedded.contacts[0].id;
            await fetchNewLead(contactID)
            response.send('success');
        } catch (e) {
            response.status(500).send('unknown err')
        }
    } else {
        try {
            let contactId
            if (resultWithPhone) {
                contactId = resultWithPhone._embedded.contacts[0].id
            } else {
                contactId = resultWithEmail._embedded.contacts[0].id
            }
            let ans = await fetchPatchContact(name, email, phoneNumber, contactId)
            response.send('success');
        } catch (e) {
            response.status(500).send('unknown err')
        }
    }
});


const server = app.listen(process.env.PORT);
console.log(`start server on http://${process.env.HOST}:${process.env.PORT}/`);


(async function() {
    let result = await fetchGetTokens({
        "code": process.env.AUTH_CODE,
        "grant_type": "authorization_code",
    })
    checkingResultTokens(result);
})()



async function fetchGetContact(query) {

    let result
    try {
        let response = await fetch(process.env.EXTERNAL_API + '/api/v4/contacts?query=' + query, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken,
            },
        });

        if (response.status === 200) {
            result = await response.json();
        } else if (response.status === 204) {
            result = 0;
        } else {
            throw new Error('Unknown err')
        }
    } catch (e) {
        console.log(e)
    }

    return result

}
async function fetchNewContact(name, email, phoneNumber) {

    let response = await fetch(process.env.EXTERNAL_API + '/api/v4/contacts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken,
        },
        body: JSON.stringify([
            {
                name: name,
                "custom_fields_values": [
                    {
                        "field_code": "PHONE",
                        "values": [
                            {
                                "value": phoneNumber,
                                "enum_code": "WORK"
                            }
                        ]
                    },
                    {
                        "field_code": "EMAIL",
                        "values": [
                            {
                                "value": email,
                                "enum_code": "WORK"
                            }
                        ]
                    }
                ]
            }
        ])
    });

    return await response.json();
}
async function fetchNewLead(contactID) {

    let response = await fetch(process.env.EXTERNAL_API + '/api/v4/leads', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken,
        },
        body: JSON.stringify([
            {
                _embedded: {
                    contacts: [
                        {id: contactID}
                    ]
                }
            }
        ])
    });

    return await response.json();
}
async function fetchPatchContact(name, email, phoneNumber, contactId) {

    let response = await fetch(process.env.EXTERNAL_API + '/api/v4/contacts/' + contactId, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken,
        },
        body: JSON.stringify({
            name: name,
            "custom_fields_values": [
                {
                    "field_code": "PHONE",
                    "values": [
                        {
                            "value": phoneNumber,
                            "enum_code": "WORK"
                        }
                    ]
                },
                {
                    "field_code": "EMAIL",
                    "values": [
                        {
                            "value": email,
                            "enum_code": "WORK"
                        }
                    ]
                }
            ]
        })
    });

    return await response.json();
}

async function fetchGetTokens(bodyPart) {
    let body = {
        "client_id": process.env.CID,
        "client_secret": process.env.CLIENT_SECRET_CODE,
        "redirect_uri": `http://${process.env.HOST}:${process.env.PORT}/`,
    }
    Object.assign(body, bodyPart)
    let result

    try {
        let response = await fetch(process.env.EXTERNAL_API + '/oauth2/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });
        result = await response.json()
        return result
    } catch (e) {
        console.log(e)
    }
}

 function checkingResultTokens(result) {
    if (result.refresh_token && result.access_token) {
        let expiresIn;
        accessToken = result.access_token;
        refreshToken = result.refresh_token;
        if (result.expires_in) {
            expiresIn = result.expires_in;
        } else {
            expiresIn = 86400;
        }
        whenExpires = currentDate + expiresIn * 1000;
    } else {
        console.log(result)
        server.close()
    }
}
