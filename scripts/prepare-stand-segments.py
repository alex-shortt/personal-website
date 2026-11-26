"""Split the optimized stand into fixed-size base, repeatable pole, and cap.
Run after prepare-studio-models.py. Requires NumPy; preserves textures and UVs.
The original stand's approved 3 m calibration is baked once, never height-scaled.
"""
from pathlib import Path
import json, struct
import numpy as np

root = Path(__file__).resolve().parents[1]
raw = (root/'public/models/stand.glb').read_bytes()
n = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20+n])
blob = bytearray(raw[28+n:])
primitive = doc['meshes'][0]['primitives'][0]
def read(index):
    a = doc['accessors'][index]; v = doc['bufferViews'][a['bufferView']]
    size = {'SCALAR':1, 'VEC2':2, 'VEC3':3}[a['type']]
    dtype = '<f4' if a['componentType'] == 5126 else '<u2'
    return np.frombuffer(blob, dtype=dtype, count=a['count']*size,
                         offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,size).copy()
attrs = {key:read(i) for key,i in primitive['attributes'].items()}
triangles = read(primitive['indices']).reshape(-1,3)
packed = np.concatenate([attrs['POSITION'], attrs['NORMAL'], attrs['TEXCOORD_0']], axis=1)
scale = np.array([2.1,3.0,2.1])
# Retain only embedded images from the source buffer; rebuild geometry compactly.
images=[]
for image in doc['images']:
    view=doc['bufferViews'][image['bufferView']]
    images.append(bytes(blob[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]))
blob=bytearray();doc['bufferViews']=[];doc['accessors']=[]
for image,data in zip(doc['images'],images):
    while len(blob)%4:blob.append(0)
    image['bufferView']=len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)})
    blob.extend(data)

def clip(poly, level, above):
    out=[]
    for a,b in zip(poly, poly[1:]+poly[:1]):
        ina = a[1]>=level if above else a[1]<=level
        inb = b[1]>=level if above else b[1]<=level
        if ina: out.append(a)
        if ina != inb: out.append(a+(b-a)*((level-a[1])/(b[1]-a[1])))
    return out

def accessor(data, kind):
    while len(blob)%4: blob.append(0)
    vi=len(doc['bufferViews']); doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':data.nbytes})
    blob.extend(data.tobytes())
    ai=len(doc['accessors']); item={'bufferView':vi,'componentType':5123 if kind=='SCALAR' else 5126,'count':len(data),'type':kind}
    if kind=='VEC3': item.update(min=data.min(0).tolist(),max=data.max(0).tolist())
    doc['accessors'].append(item); return ai

meshes=[]
for name, low, high in [('base',0,.32),('segment',.53,.675),('cap',.92,1.01)]:
    vertices=[]
    for triangle in triangles:
        poly=clip(clip([v.copy() for v in packed[triangle]],low,True),high,False)
        for j in range(1,len(poly)-1): vertices.extend([poly[0],poly[j],poly[j+1]])
    v=np.array(vertices,dtype=np.float32);v[:,1]-=low;v[:,:3]*=scale
    v[:,3:6]/=scale; v[:,3:6]/=np.maximum(np.linalg.norm(v[:,3:6],axis=1,keepdims=True),1e-8)
    v,indices=np.unique(v,axis=0,return_inverse=True)
    meshes.append({'name':name,'primitives':[{'attributes':{
        'POSITION':accessor(v[:,:3].copy(),'VEC3'),
        'NORMAL':accessor(v[:,3:6].copy(),'VEC3'),
        'TEXCOORD_0':accessor(v[:,6:].copy(),'VEC2')},'indices':accessor(indices.astype('<u2'),'SCALAR'),'material':0}]})
    print(name, 'height',float(v[:,1].max()),'triangles',len(indices)//3)
doc['meshes']=meshes
doc['nodes']=[{'name':m['name'],'mesh':i} for i,m in enumerate(meshes)]
doc['scenes']=[{'nodes':list(range(3))}];doc['scene']=0
doc['asset']['generator']='prepare-stand-segments.py'
doc['buffers'][0]['byteLength']=len(blob)
data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*((-len(data))%4);blob+=b'\0'*((-len(blob))%4)
out=struct.pack('<III',0x46546c67,2,28+len(data)+len(blob))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(blob),0x004e4942)+blob
(root/'public/models/stand-segmented.glb').write_bytes(out)
