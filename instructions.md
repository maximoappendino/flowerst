# 

# File structure:

project/
├── src/
│   ├── css/
│   ├── js/
│   └── index.html
├── img/
├── package.json
├── settings.js
└── README.md

# Script

## Fetch catalog

I want that every an hour or even a day the website updates the catalog. The catalog of this website will sync with a link to a spreadsheet the customer is free to edit on his account. This only fetches the spreadsheet data to add it to the html so it can be searched by bots and AI. Not the pictures, the pictures will still be on the client's google account. Pictures appear and are fetched as the users scrolls down.
Maybe during build time or github actions can be in charge of this function.


## Settings.js

Settings will include like the whatsapp phone number for the button, client e-mail.
Also the link to the catalog spreadsheets and catalog images folder

## Cart / Whatsapp button

If there's something in the cart it will include that to the message that will be sent when pressing the Whatsapp button


# Catalog

## Spreadhseet

The spreadsheet will usually be in the client's google drive folder. He will share with me the link for me and the fetch script to have access.

The structure will be like the following:

Column A: Name of the product
Column B: Price
Column C: Category of the product
Column D: Description
Column E: Link to the image

Now from here it will be for variants. And sometimes variants have different prices the columns will be consequential.

Column F: variant
Column G: price of variant of column F
Column H: variant
Column I: price of variant of column H
And so on

Lets test with this spreadsheet
https://docs.google.com/spreadsheets/d/1dVZQ9njepNWxefuMsPj8OvrsFuDiq5ea8rxg-TP71F0/edit?usp=sharing

# Layout
> [!NOTE]
> "Upload files" Asks the user to upload files and sends them to a folder in the shopkeeper account google drive account so they can get the files of the client and start printing. Whatsapp will only be the medium of communication and negotiation. Link to the folder: https://drive.google.com/drive/folders/1-VcN-RfnFKbAgGn7CnPR3miqHpChGY-o?usp=sharing

[ Home | About us | Logo (big) | Upload files | Cart ]
[ Carrousel ]
[ Phrases, indications or something the client wants to put in a text in here]
[ Catalog ]
[ Title, category, variant, description, price | Picture]
[ Picture | Title, category, variant, description, price ]

