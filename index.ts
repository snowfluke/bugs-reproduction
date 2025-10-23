import * as cv from "@techstark/opencv-js";



const mat = new cv.Mat()

const server = Bun.serve({
	routes: {
		'/api/status': () => {
        
            return new Response('OK')},
	},

	fetch(req) {
		return new Response('Not Found', {status: 404});
	},
});

console.log(`Server running at ${server.url}`);