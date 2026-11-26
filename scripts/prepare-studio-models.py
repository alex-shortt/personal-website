"""Prepare the two CC-BY models in tmp/*.zip. Requires numpy and Pillow.
Removes softbox/beam, preserves authored normals/UVs, and bakes small JPEG
textures into decoder-free GLBs. Attribution is in public/models/credits.txt.
"""
import io, json, pathlib, struct, zipfile
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models'
OUT.mkdir(exist_ok=True)

def prepare(name, target):
    with zipfile.ZipFile(ROOT / 'tmp' / (name + '.zip')) as z:
        g = json.loads(z.read('scene.gltf'))
        def acc(i):
            a=g['accessors'][i]; v=g['bufferViews'][a['bufferView']]
            b=z.read(g['buffers'][v['buffer']]['uri'])
            n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
            dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
            return np.ndarray((a['count'],n),dtype=dtype,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dtype).itemsize*n),np.dtype(dtype).itemsize)).copy()
        stand=target=='stand'
        p=g['meshes'][0 if stand else 1]['primitives'][0]
        attrs={k:acc(v) for k,v in p['attributes'].items() if k in ['POSITION','NORMAL','TEXCOORD_0']}
        triangles=acc(p['indices']).reshape(-1,3)
        if stand:
            # All stand triangles are below 9.6; the overlapping softbox lives
            # beyond x=1.06, so exclude that connected housing explicitly.
            v=attrs['POSITION']
            triangles=triangles[(v[triangles,2].max(1)<9.6) & ~((v[triangles,0].min(1)>1.0)&(v[triangles,2].max(1)>7))]
        used,indices=np.unique(triangles,return_inverse=True)
        attrs={k:v[used] for k,v in attrs.items()}
        if stand:
            attrs['POSITION']=attrs['POSITION'][:,[0,2,1]]*np.array([1,1,-1])/9.58
            attrs['POSITION'][:,1]-=attrs['POSITION'][:,1].min()
            attrs['NORMAL']=attrs['NORMAL'][:,[0,2,1]]*np.array([1,1,-1])
        else:
            # Undo the authored 20-degree lamp tilt, put lens center at origin,
            # and put the mounting yoke underneath. Local +Z is emission axis.
            a=np.deg2rad(-20); r=np.array([[1,0,0],[0,np.cos(a),-np.sin(a)],[0,np.sin(a),np.cos(a)]])
            attrs['POSITION']=attrs['POSITION']@r.T
            attrs['POSITION']-=np.array([0,0,23.5])
            attrs['POSITION']*=np.array([-1,-1,1])*.012
            attrs['NORMAL']=(attrs['NORMAL']@r.T)*np.array([-1,-1,1])
        doc={'asset':{'version':'2.0','generator':'prepare-studio-models.py','copyright':('Glowbox 3D' if stand else 'R3indeer')+' / CC-BY-4.0; see credits.txt'},'scenes':[{'nodes':[0]}],'scene':0,'nodes':[{'mesh':0}],'meshes':[{'primitives':[{'attributes':{},'material':0}]}],'accessors':[],'bufferViews':[],'buffers':[{}],'images':[],'textures':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]}
        blob=bytearray()
        def view(data):
            while len(blob)%4:blob.append(0)
            i=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob.extend(data);return i
        def accessor(data,kind):
            i=len(doc['accessors']);a={'bufferView':view(data.tobytes()),'componentType':5123 if kind=='SCALAR' else 5126,'count':len(data),'type':kind}
            if kind=='VEC3':a.update(min=data.min(0).tolist(),max=data.max(0).tolist())
            doc['accessors'].append(a);return i
        prim=doc['meshes'][0]['primitives'][0]
        for k,v in attrs.items():prim['attributes'][k]=accessor(v.astype('<f4'),'VEC2' if k=='TEXCOORD_0' else 'VEC3')
        prim['indices']=accessor(indices.astype('<u2'),'SCALAR')
        mat=g['materials'][0]
        def tex(info):
            image=g['images'][g['textures'][info['index']]['source']]
            im=Image.open(io.BytesIO(z.read(image['uri']))).convert('RGB');im.thumbnail((256,256) if stand else (512,512),Image.Resampling.LANCZOS)
            data=io.BytesIO();im.save(data,format='JPEG',quality=90)
            i=len(doc['images']);doc['images'].append({'bufferView':view(data.getvalue()),'mimeType':'image/jpeg'});doc['textures'].append({'source':i,'sampler':0});return {'index':i}
        pbr=mat['pbrMetallicRoughness']
        material={'name':target,'pbrMetallicRoughness':{'baseColorTexture':tex(pbr['baseColorTexture']),'metallicRoughnessTexture':tex(pbr['metallicRoughnessTexture'])},'normalTexture':tex(mat['normalTexture'])}
        if not stand:
            material['emissiveTexture']=tex(mat['emissiveTexture']);material['emissiveFactor']=[.7,.7,.7]
        doc['materials']=[material];doc['buffers'][0]['byteLength']=len(blob)
        data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*((-len(data))%4);blob+=b'\0'*((-len(blob))%4)
        glb=struct.pack('<III',0x46546c67,2,12+8+len(data)+8+len(blob))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(blob),0x004e4942)+blob
        (OUT/(target+'.glb')).write_bytes(glb)
        print(target,len(used),'vertices',len(indices)//3,'triangles',len(glb),'bytes')
        return z.read('license.txt').decode()
credits=prepare('studio_softbox_light','stand')+'\nModified: removed softbox and lamp, normalized stand, resized/recompressed textures; derived modular base, repeatable pole section and top mount.\n\n'+prepare('spotlight','spotlight')+'\nModified: removed cable and beam meshes, aligned lamp, resized/recompressed textures.\n'
(OUT/'credits.txt').write_text(credits)
