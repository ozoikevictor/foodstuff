import {deleteApp} from 'firebase-admin/app';
import {firebaseServices} from '../firebase.mjs';
import {firebaseAuthProjectConfig,firebaseEmailPasswordEnabled} from '../firebase-auth.mjs';
let app;
let db;
try {
  ({app,db}=firebaseServices());
  const config=await firebaseAuthProjectConfig(app);
  const emailPasswordEnabled=firebaseEmailPasswordEnabled(config);
  const apiKeyAvailable=!!(process.env.FIREBASE_WEB_API_KEY?.trim()||config.client?.apiKey);
  console.log(JSON.stringify({projectId:app.options.projectId,emailPasswordEnabled,apiKeyAvailable}));
  if(!emailPasswordEnabled||!apiKeyAvailable){console.error('Setup incomplete: enable Email/Password and confirm a Web API key is available.');process.exitCode=1;}
} catch(error) {
  console.error(error.status?error.message:'Could not check Firebase Authentication configuration. Check credentials and network access.');
  process.exitCode=1;
} finally {await db?.terminate().catch(()=>{});if(app)await deleteApp(app).catch(()=>{});}
