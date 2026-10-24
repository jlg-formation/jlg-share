import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { api } from './api';
// Only this adapter imports LiveKit. Screens and chat use browser-native video elements.
export async function openScreen(sessionId:string,publish:boolean,onVideo:(stream:MediaStream|null)=>void,onStatus:(status:string)=>void){
 let capture:MediaStream|undefined;
 let room:Room|undefined;
 let stopped=false; let granted=false;
 const base='/sessions/'+sessionId;
 const stop=async()=>{
  if(stopped)return;stopped=true;
  capture?.getTracks().forEach(t=>t.stop());
  await room?.disconnect();onVideo(null);onStatus('');
  if(publish&&granted)await api(base+'/media/stop','POST',{}).catch(()=>{});
 };
 try{
  if(publish){
   if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Le partage d’écran nécessite HTTPS et un navigateur compatible sur ordinateur.');
   capture=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:5,max:10},width:{ideal:1920},height:{ideal:1080}},audio:false});
   capture.getAudioTracks().forEach(t=>{t.stop();capture!.removeTrack(t);});
  }
  onStatus('Connexion au partage d’écran…');
  const access=await api<{url:string;token:string}>(base+'/media','POST',{publish});granted=true;
  room=new Room({adaptiveStream:true,dynacast:true});
  room.on(RoomEvent.TrackSubscribed,(track:RemoteTrack)=>{if(track.kind===Track.Kind.Video){onVideo(new MediaStream([track.mediaStreamTrack]));onStatus('Diffusion en direct');}});
  room.on(RoomEvent.TrackUnsubscribed,()=>{if(!publish){onVideo(null);onStatus('Le formateur a arrêté sa diffusion.');}});
  room.on(RoomEvent.Reconnecting,()=>onStatus('Reconnexion au partage d’écran…'));
  room.on(RoomEvent.Reconnected,()=>onStatus('Connecté au partage d’écran'));
  room.on(RoomEvent.Disconnected,()=>{if(!stopped){capture?.getTracks().forEach(t=>t.stop());onVideo(null);onStatus('Partage déconnecté. Vous pouvez vous reconnecter.');}});
  await room.connect(access.url,access.token);
  if(publish&&capture){const track=capture.getVideoTracks()[0];track.contentHint='detail';await room.localParticipant.publishTrack(track,{source:Track.Source.ScreenShare,simulcast:false,videoEncoding:{maxBitrate:3_000_000,maxFramerate:10}});onVideo(capture);onStatus('Votre écran est partagé');track.addEventListener('ended',()=>void stop(),{once:true});}
  else onStatus('Connecté. En attente de l’écran du formateur…');
  return {stop};
 }catch(e){await stop();throw e;}
}
