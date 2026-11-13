const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('six',{action:(action,id)=>ipcRenderer.invoke('action',{action,id}),onState:fn=>ipcRenderer.on('state',(_e,s)=>fn(s))});
