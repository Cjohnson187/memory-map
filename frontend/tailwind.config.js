/** @type {import('tailwindcss').Config} */
// export default {
//   content: [
//       "./index.html",
//       "./src/**/*.{js,ts,jsx,tsx}",
//   ],
//   theme: {
//     extend: {},
//   },
//   plugins: [],
// }

export default {
    content: [
        "./index.html",
        // IMPORTANT: This line tells Tailwind where to find your React components
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}


