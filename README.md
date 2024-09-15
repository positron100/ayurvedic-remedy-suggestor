# Ayurvedic Remedy Suggestor

This is a MERN stack-based web application designed to provide Ayurvedic remedy suggestions based on user-input data like disease, gender, age, and severity. The app allows users to input their details and fetches relevant Ayurvedic medicines from the database.

# recommendation 
it is my recommendation to fill the data fields in search form in search webpage in the same manner as provided in the .csv file , otherwise it  will not generate productive results.


## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Technologies Used](#technologies-used)
- [License](#license)

## Features

- **Homepage**: Displays information about Ayurvedic products and the brand.
- **Search for Remedies**: Users can search for Ayurvedic medicines by inputting their disease, gender, severity, and age.
- **Contact Form**: Users can contact the admin by filling in their personal details, which are stored in the database.
- **Database Interaction**: The app stores user queries and fetches corresponding remedies based on the provided information from MongoDB.
  
## Installation

1. **Clone the repository**:

    ```bash
    git clone https://github.com/your-repo/ayurvedic-remedy-suggestor.git
    ```

2. **Install dependencies**:

    Navigate to the root of the project and run:

    ```bash
    npm install
    ```

3. **Start the server**:

    To start the development server:

    ```bash
    npm run dev
    ```

    The application will run at remote server in cloud mongodb atlas due to ehich can acssess the application at anytime.

4. **MongoDB setup**:

    Ensure you have MongoDB installed and running. The app uses a local MongoDB instance running at `mongodb://localhost/demo`.

## Usage

1. Navigate to the homepage at to explore the Ayurvedic products.
2. Go to the **Search** section to input details like disease, gender, severity, and age to find Ayurvedic remedies.
3. Use the **Contact** section to send a message or query to the admin.
4. The remedies for the search inputs will be displayed based on the database entries.

## Project Structure

```
├── app.js               # Main application file
├── package.json         # Dependency management
├── views
│   ├── ayurved.pug      # Homepage
│   ├── contact.pug      # Contact form
│   ├── details.pug      # Details form for remedy search
│   ├── medicine.pug     # Displays Ayurvedic medicine results
├── static
│   ├── ayurved.css      # CSS for the homepage
│   └── images           # Image assets
```

### Key Routes

1. **GET `/`**: Loads the homepage (`ayurved.pug`) which provides an overview of the site and Ayurvedic offerings.
2. **GET `/contact`**: Renders the contact form (`contact.pug`) for user input.
3. **POST `/contact`**: Stores contact details entered by users in the MongoDB database.
4. **GET `/details`**: Displays a form (`details.pug`) where users can enter disease, gender, severity, and age.
5. **POST `/details`**: Fetches remedies from the database based on user input and displays them using the `medicine.pug` template.

## Technologies Used

- **Frontend**: HTML, CSS (via Pug templates)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (with Mongoose for data modeling)
- **Templating Engine**: Pug
- **Other Dependencies**:
  - `body-parser`: For parsing request bodies.
  - `nodemon`: For live reloading during development.

## License

This project is licensed under the ISC License - see the `LICENSE` file for details.

---

This content covers the basic structure, functionality, and technologies used in your project. Let me know if you'd like to add anything else!

