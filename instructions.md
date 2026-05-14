# Goal
Create e-commerce website

# Layout

1. Navbar:
[ Recargar Pagina | logo | Subir archivos | Carrito ]

Recargar Pagina: Fetches the new database and images
Logo: BIG, in the middle
Subir Archivos: Button, pops a window to upload files to the shopkeepers google drive folder. Later, the shopkeeper can see whats on the queue to print
Inicio: Goes to the main menu
Carrito: Opens a side panel with all the details and when the Whatsapp button is pressed, it goes to wa.me with the list, the price of each item, and the total.

2. Hero Banner

3. Guide

Just a couple of steps in how to use the website. Basically the client choose whatever they want from the catalog down below, goes to the cart, click the whatsapp button to contact the shopkeeper, coordinate payment, go back and upload the files.

4. Catalog

- There are tags the customer can click on to filter items
- There are buttons to sort those items (name, price)
- Search bar
- When the customer clicks on an image or a product, they see the entire description, all the pictures, and all variations. It's just a pop up, not an entire page 

Layout:
[ img | details]
[ details | img]
[ img | details]
[ details | img]

5. "No encontraste lo que buscabas?"

And then again a whatsapp button in case the customer wants to print something specific

6. Footer

# File tree

./index.html
./styles.css
./scripts
./settings.json (json or whatever fits best)

# Scripts

I need you to teach me what is possible and ask questions in that margin because what I imagine is that this website fetches a folder inside the client's google drive with a link. 
Once it fetches the update, it creates a diff to remove or add new items to the index.html file
I want that so customers can find this website by searching for the product name, potentially.
Maybe this can run once an hour. I do not know if I could use github actions or netlify features. What do you recommend?

That folder will contain
./queue/ (where customers drop their files)
./img/ (where the shopkeeper drops the catalog's images)
./spreadsheet (where the shopkeeper edits the database of their products)

## Queue: For now let's settle down with a link to the folder. Later we'll set up a google cloud project so the customers can ONLY DROP files

## img

ID-1.png or jpg or jpeg or webp
ID is declared by the spreadsheet
And then 1, 2, 3... is for the catalog to have more images of the same product.

## Spreadsheet

Column A: ID
Column B: Title
Column C: Price
Column D: Categories (separated by commas)
Column E: Description
Column F: Variations (separated by commas)
Column G: Prices of those variations (separated by commas)



# The idea is:

To have something I can refer to and easily apply this scripts to another website I might create for another client. So it needs to be reusable.

