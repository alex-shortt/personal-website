export const volumeVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const densityFunctions = /* glsl */ `
  uniform int uDensityMode;
  uniform float uDensityMultiplier;
  uniform float uNoiseScale;
  uniform float uErosion;
  uniform bool uRounderDepth;
  uniform bool uFlowEnabled;
  uniform float uFloatAmount;
  uniform float uFloatPeriod;
  uniform float uSwayAmount;
  uniform float uBillowStrength;
  uniform float uCirculationSpeed;
  uniform float uVortexSize;
  uniform float uSecondaryVortex;
  uniform float uEvolutionSpeed;
  uniform float uLegacyDrift;
  uniform highp sampler3D uFluidField;
  uniform bool uFluidActive;
  // The reference limits XY coverage; its section profile only supplies a
  // broad container. Billows come from the 3D noise field inside that container.
  vec3 shapeProfile(vec3 p) {
    vec2 uv=(p.xy+BOUNDS.xy)/(2.0*BOUNDS.xy);
    vec2 size=vec2(512.0,320.0);
    return texture(uShape,(uv*(size-1.0)+0.5)/size).rgb;
  }
  vec3 movingPoint(vec3 p) {
    if (!uFlowEnabled) { p.y -= sin(uTime * 0.19) * 0.035; return p; }
    float phase=uTime*6.28318530718/uFloatPeriod;
    p-=vec3(uSwayAmount*sin(phase*0.73+1.3),
      uFloatAmount*(0.85*sin(phase+0.45)+0.15*sin(phase*1.37+2.1)),
      uSwayAmount*0.5*sin(phase*0.91+3.8));
    return p;
  }
  vec3 vortex(vec3 p, vec3 center, vec3 axis, float angle, float radius) {
    vec3 q=p-center;
    float a=angle*exp(-dot(q,q)/(radius*radius));
    float c=cos(a), s=sin(a);
    return center+q*c+cross(axis,q)*s+axis*dot(axis,q)*(1.0-c);
  }
  vec3 flowPoint(vec3 p, float envelope) {
    if (!uFlowEnabled) return p;
    float t=uTime*uCirculationSpeed;
    // Bounded local rotations avoid accumulating twisted ribbons. Each axis
    // and temporal frequency differs; neither rotates the silhouette itself.
    vec3 q=vortex(p,vec3(0.35,0.22,0.0),vec3(0,0,1),
      uBillowStrength*sin(t+0.7),uVortexSize);
    q=vortex(q,vec3(-0.65,-0.24,0.10),vec3(1,0,0),
      -uBillowStrength*uSecondaryVortex*sin(t*0.79+2.4),uVortexSize*0.8);
    vec3 phase=p.yzx*2.1+vec3(0.4,2.2,4.1);
    q+=0.12*uBillowStrength*(sin(phase+uTime*uEvolutionSpeed*vec3(0.83,1.17,0.69))-sin(phase));
    return mix(p,q,envelope);
  }
  vec3 advectedPoint(vec3 p) {
    if (!uFlowEnabled) return p;
    if (uFluidActive) {
      vec3 uv=clamp((p+BOUNDS)/(2.0*BOUNDS),0.0,1.0);
      vec3 size=vec3(20.0,12.0,16.0);
      return p-texture(uFluidField,(uv*(size-1.0)+0.5)/size).xyz;
    }
    return p;
  }
  float baseDensity(vec3 p, bool detail) {
    if (any(greaterThan(abs(p),BOUNDS))) return 0.0;
    if (uDensityMode == 2) {
      // Diagnostic baseline: the existing noise texture in a simple ellipsoid.
      // No reference mask, regional constraints, core, or saturated density ramp.
      vec3 drift=vec3(uTime*0.006,uTime*0.002,-uTime*0.003)*uLegacyDrift;
      float n=texture(uDensity,p*0.72*uNoiseScale+drift).r;
      float shape=(1.0-length(p/vec3(1.65,0.78,0.95)))*0.75;
      float field=shape+(n-0.54)*0.70;
      if (detail) field-=(1.0-texture(uDensity,p*2.9*uNoiseScale-drift*0.6).r)*uErosion;
      return max(field,0.0)*4.0;
    }
    vec3 profile=shapeProfile(p);
    float outline=profile.r*0.625-0.125;
    if (outline < -0.004) return 0.0;
    float halfDepth=profile.g*BOUNDS.z;
    float center=profile.b*1.3-0.65;
    if (uRounderDepth) {
      // Shorten long extruded sections most where the front footprint is thin.
      // Keep the existing noise and filled center; no manually placed mounds.
      float mainBody=smoothstep(0.18,0.40,halfDepth);
      halfDepth*=mix(1.0,mix(0.60,0.95,smoothstep(0.015,0.30,outline)),mainBody);
      center*=mix(1.0,0.75,mainBody);
    }
    if (halfDepth-abs(p.z-center) < -0.10) return 0.0;
    vec3 drift=vec3(uTime*0.006,uTime*0.002,-uTime*0.003)*uLegacyDrift;
    float flowEnvelope=smoothstep(0.005,0.12,outline)*smoothstep(0.12,0.35,halfDepth);
    vec3 noisePoint=flowPoint(p,flowEnvelope);
    float n=texture(uDensity,noisePoint*0.72*uNoiseScale+drift).r;
    // Let boundary contacts occur at different depths instead of exposing the
    // same XY contour across an entire column. Preserve a narrow interior
    // connection, and keep shallow wisps out of this stronger erosion.
    float relativeZ=abs(p.z-center)/max(halfDepth,0.01);
    float boundaryVariation=0.14*(1.0-smoothstep(0.30,0.70,n));
    boundaryVariation*=smoothstep(0.05,0.45,relativeZ)*smoothstep(0.18,0.40,halfDepth);
    boundaryVariation*=1.0-smoothstep(0.10,0.28,outline);
    outline-=boundaryVariation;
    if (outline < -0.004) return 0.0;
    // A rounded shoulder collapses depth as it approaches the fixed outline.
    // Use a narrower inward band for the shallow detached wisps.
    float edgeWidth=mix(uEdgeWidths.x,uEdgeWidths.y,smoothstep(0.15,0.30,halfDepth));
    float edgeT=clamp((outline+0.002)/edgeWidth,0.0,1.0);
    float rounding=sqrt(edgeT*(2.0-edgeT));
    halfDepth*=rounding;
    float depth=halfDepth-abs(p.z-center);
    if (depth < -0.10) return 0.0;
    float footprint=smoothstep(-0.002,min(edgeWidth*0.45,0.035),outline);
    // Prevent noise or the protected core from extending past the rounded
    // shoulder. Fade this limit out in the interior to retain natural billows.
    float depthFeather=max(0.004,0.04*rounding);
    float shoulder=smoothstep(-depthFeather,depthFeather,depth);
    shoulder=mix(shoulder,1.0,smoothstep(0.8,1.0,edgeT));
    float shell=min(outline*4.0,depth)+(n-0.54)*0.70;
    if (detail) {
      float fine=texture(uDensity,noisePoint*2.9*uNoiseScale-drift*0.6).r;
      shell-=(1.0-fine)*uErosion;
    }
    float billows=smoothstep(-0.025,0.14,shell)*0.95;
    // A softly varying interior prevents holes without exposing an opaque
    // extrusion surface. It merges into the eroded 3D shell with no hard seam.
    if (uDensityMode == 1) return footprint*shoulder*billows;
    float coreWidth=max(halfDepth*0.44+0.045*rounding,0.001);
    float coreZ=(p.z-center-(n-0.5)*0.10*rounding)/coreWidth;
    float core=0.82*exp(-coreZ*coreZ*coreZ*coreZ);
    // Keep an occupied interior, but let its density vary in all three axes.
    // A uniform protected core otherwise reads as a flat band from above.
    float coreVariation=mix(0.48,1.0,smoothstep(0.25,0.70,n));
    core*=mix(1.0,coreVariation,smoothstep(0.18,0.40,halfDepth));
    core*=smoothstep(-0.10,0.06,depth);
    return footprint*shoulder*max(billows,core);
  }
  float density(vec3 p, bool detail) {
    vec3 source=advectedPoint(movingPoint(p));
    return baseDensity(source,detail)*uDensityMultiplier;
  }
  vec2 intersectBox(vec3 origin, vec3 direction) {
    vec3 inv = 1.0 / direction;
    vec3 a = (-BOUNDS-origin)*inv;
    vec3 b = (BOUNDS-origin)*inv;
    vec3 nearP = min(a,b), farP = max(a,b);
    return vec2(max(nearP.x,max(nearP.y,nearP.z)), min(farP.x,min(farP.y,farP.z)));
  }
`;

export const volumeFragment = /* glsl */ `
  precision highp sampler3D;
  uniform sampler3D uDensity;
  uniform sampler2D uShape;
  uniform vec2 uEdgeWidths;
  uniform sampler2D uJitter;
  uniform sampler2D uLighting;
  uniform sampler2D uDirectionalLighting;
  uniform vec3 uDirectionalDirection;
  uniform vec3 uDirectionalColor;
  uniform float uDirectionalIntensity;
  uniform float uTime;
  uniform int uSteps;
  uniform bool uOrthographic;
  uniform vec3 uViewDirection;
  uniform vec3 uLightPosition[2];
  uniform vec3 uLightColor[2];
  uniform vec3 uAmbient;
  uniform float uSeparation;
  uniform float uTransitionWidth;
  uniform float uColorVariation;
  uniform bool uNeutral;
  uniform bool uInternal;
  varying vec3 vWorld;
  const vec3 BOUNDS = vec3(2.05, 1.2, 1.55);
  uniform float uViewExtinction;
  uniform float uPhase;
  const float PI = 3.14159265;
  ${densityFunctions}
  float hg(float cosine, float g) {
    float inv = inversesqrt(max(1.0+g*g-2.0*g*cosine,0.01));
    return (1.0-g*g)*inv*inv*inv/(4.0*PI);
  }
  float phase(float cosine) {
    return mix(hg(cosine,-0.18),hg(cosine,uPhase),0.8);
  }
  vec2 atlasUV(vec2 xy, float slice) {
    vec2 tile = vec2(mod(slice,8.0),floor(slice/8.0));
    return (tile*vec2(48.0,24.0) + xy*vec2(47.0,23.0)+0.5)/vec2(384.0,72.0);
  }
  vec4 cachedLighting(vec3 p) {
    vec3 uvw=clamp((p+BOUNDS)/(2.0*BOUNDS),0.0,1.0);
    float z=uvw.z*23.0;
    float slice=floor(z);
    return mix(texture2D(uLighting,atlasUV(uvw.xy,slice)),
               texture2D(uLighting,atlasUV(uvw.xy,min(slice+1.0,23.0))),fract(z));
  }
  float cachedDirectional(vec3 p) {
    vec3 uvw=clamp((p+BOUNDS)/(2.0*BOUNDS),0.0,1.0);
    float z=uvw.z*23.0;
    float slice=floor(z);
    return mix(texture2D(uDirectionalLighting,atlasUV(uvw.xy,slice)).r,
      texture2D(uDirectionalLighting,atlasUV(uvw.xy,min(slice+1.0,23.0))).r,fract(z));
  }
  vec3 lighting(vec3 p, vec3 viewRay, float d) {
    vec4 cached=cachedLighting(p);
    // Isotropic single scattering for diagnosis; no artistic dominance or AO.
    if (uNeutral) return cached.r*uLightColor[0]/(4.0*PI)+uAmbient;
    if (uInternal) return (cached.r*uLightColor[0]+cached.g*uLightColor[1])/(4.0*PI)+uAmbient;
    vec3 L0=normalize(uLightPosition[0]-p);
    vec3 L1=normalize(uLightPosition[1]-p);
    vec2 energy=vec2(cached.r*phase(dot(viewRay,L0))+cached.b/(4.0*PI),
                     cached.g*phase(dot(viewRay,L1))+cached.a/(4.0*PI));
    float total=energy.x+energy.y;
    float weight=energy.x/max(total,0.00001);
    if (uColorVariation > 0.0) {
      // Artistic world-space variation in light visibility. Attenuate the
      // competing light instead of borrowing its brightness for the winner.
      // This preserves shading within colored patches; no view-space mask.
      vec3 q=advectedPoint(movingPoint(p));
      if (uFlowEnabled) {
        vec3 profile=shapeProfile(q);
        q=flowPoint(q,smoothstep(0.005,0.12,profile.r*0.625-0.125)*smoothstep(0.12,0.35,profile.g*BOUNDS.z));
      }
      float billow=texture(uDensity,q*vec3(0.55,0.65,0.20)+vec3(0.17,0.43,0.09)).r;
      float bias=clamp((billow-0.50)*4.0,-1.0,1.0)*uColorVariation;
      energy*=exp(vec2(min(bias,0.0),min(-bias,0.0)));
      total=energy.x+energy.y;
      weight=energy.x/max(total,0.00001);
    }
    // Artistic winner-takes-most: retain a narrow smooth crossover, but do not
    // double brightness where the beams meet. Actual direct + bounced energy
    // determines the winner independently at each volume sample.
    float winner=smoothstep(0.5-uTransitionWidth,0.5+uTransitionWidth,weight);
    weight=mix(weight,winner,uSeparation);
    float strength=mix(total,max(energy.x,energy.y),uSeparation);
    vec3 result=strength*mix(uLightColor[1],uLightColor[0],weight);
    // Broad, off-white room illumination. Approximate ambient occlusion keeps
    // dense interiors dimensional without turning unlit regions black.
    float occlusion=mix(0.60,1.0,exp(-d*1.6));
    // The neutral studio key is additive, outside the colored-light competition.
    vec3 key=uDirectionalColor*uDirectionalIntensity*cachedDirectional(p)*
      phase(dot(viewRay,uDirectionalDirection));
    return result+key+uAmbient*occlusion;
  }
  void main() {
    vec3 ray = uOrthographic ? uViewDirection : normalize(vWorld-cameraPosition);
    vec3 origin = uOrthographic
      ? vWorld-ray*dot(vWorld-cameraPosition,ray) : cameraPosition;
    vec2 hit = intersectBox(origin,ray);
    float start = max(hit.x,0.0);
    if (hit.y <= start) discard;
    float stepSize = (hit.y-start)/float(uSteps);
    float jitter = texture2D(uJitter,gl_FragCoord.xy/32.0).r;
    float transmittance = 1.0;
    vec3 radiance = vec3(0.0);
    for (int i=0; i<64; i++) {
      if (i>=uSteps || transmittance<0.015) break;
      vec3 p = origin+ray*(start+(float(i)+jitter)*stepSize);
      float d = density(p,true);
      if (d<0.002) continue;
      float stepT = exp(-d*uViewExtinction*stepSize);
      radiance += transmittance*(1.0-stepT)*lighting(p,ray,d);
      transmittance *= stepT;
    }
    float alpha = 1.0-transmittance;
    // Keep premultiplied radiance in the offscreen texture for fringe-free filtering.
    gl_FragColor = vec4(radiance,alpha);
  }
`;

// A tiny, dynamically refreshed atlas stores direct and approximate bounced
// irradiance from the two spotlight emitters. The camera still evaluates phase.
export const lightingFragment = /* glsl */ `
  precision highp sampler3D;
  uniform sampler3D uDensity;
  uniform sampler2D uShape;
  uniform vec2 uEdgeWidths;
  uniform float uTime;
  uniform bool uDirectionalPass;
  uniform vec3 uDirectionalDirection;
  uniform vec3 uLightPosition[2];
  uniform vec2 uPower;
  uniform bool uBlueInternal;
  uniform bool uInternal;
  uniform vec3 uLightDirection[2];
  uniform vec2 uLightCone[2];
  const vec3 BOUNDS = vec3(2.05,1.2,1.55);
  uniform float uLightExtinction;
  uniform vec2 uLightRange;
  uniform vec2 uLightDecay;
  uniform float uBounce;
  ${densityFunctions}
  float opticalDepth(vec3 p, vec3 direction, float distanceToLight) {
    float reach=min(distanceToLight,intersectBox(p,direction).y);
    float ds=max(reach,0.0)/12.0;
    float tau=0.0;
    for(int j=0;j<12;j++) tau+=density(p+direction*(float(j)+0.5)*ds,false)*ds;
    return tau*uLightExtinction;
  }
  void main() {
    vec2 pixel=floor(gl_FragCoord.xy);
    vec2 tile=floor(pixel/vec2(48.0,24.0));
    float slice=tile.x+tile.y*8.0;
    vec3 uvw=vec3(mod(pixel,vec2(48.0,24.0))/vec2(47.0,23.0),slice/23.0);
    vec3 p=(uvw*2.0-1.0)*BOUNDS;
    if (uDirectionalPass) {
      float tau=opticalDepth(p,uDirectionalDirection,100.0);
      gl_FragColor=vec4(exp(-tau),0.0,0.0,1.0);
      return;
    }
    vec2 direct=vec2(0.0), indirect=vec2(0.0);
    for(int light=0;light<2;light++) {
      vec3 delta=uLightPosition[light]-p;
      float dist2=max(dot(delta,delta),0.000001);
      vec3 L=delta*inversesqrt(dist2);
      // L points toward the emitter; its negative follows emitted light.
      float cone=(uInternal || (uBlueInternal && light == 0)) ? 1.0 : smoothstep(uLightCone[light].x,uLightCone[light].y,
                            dot(-L,uLightDirection[light]));
      if (cone < 0.0001) continue;
      float tau=opticalDepth(p,L,sqrt(dist2));
      // Soft spotlight cone and inverse-square attenuation, evaluated only in
      // the lighting atlas. Fixture lens centers and aims share these inputs.
      float incident=uPower[light]*cone/pow(max(sqrt(dist2),sqrt(0.1)),uLightDecay[light]);
      if (uLightRange[light] > 0.0) {
        float cutoff=clamp(1.0-pow(sqrt(dist2)/uLightRange[light],4.0),0.0,1.0);
        incident*=cutoff*cutoff;
      }
      direct[light]=incident*exp(-tau);
      // Restrained internal bounce leaves neutral pockets and keeps the
      // two direct colors localized before the mild artistic dominance adjustment.
      indirect[light]=incident*uBounce*(0.38*exp(-tau*0.65)+0.14*exp(-tau*0.30));
    }
    gl_FragColor=vec4(direct,indirect);
  }
`;

export const compositeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv=uv;
    gl_Position=vec4(position.xy,0.0,1.0);
  }
`;
export const compositeFragment = /* glsl */ `
  uniform sampler2D uCloud;
  uniform bool uSilhouette;
  uniform float uExposure;
  uniform float uSaturation;
  uniform bool uSimpleDisplay;
  uniform bool uFilmicDisplay;
  uniform float uFilmicStrength;
  uniform float uMidtoneLift;
  uniform float uBloomStrength;
  uniform vec2 uCloudTexel;
  varying vec2 vUv;
  vec3 highlight(vec4 sampleColor) {
    float peak=max(sampleColor.r,max(sampleColor.g,sampleColor.b));
    // Threshold unassociated radiance, retain premultiplication for filtering.
    return sampleColor.rgb*max(peak-0.7*sampleColor.a,0.0)/max(peak,0.00001);
  }
  vec3 bloom(vec4 center) {
    vec2 d=uCloudTexel*3.0;
    vec3 sum=highlight(center)*0.2;
    sum+=0.1*(highlight(texture2D(uCloud,vUv+vec2(d.x,0)))+highlight(texture2D(uCloud,vUv-vec2(d.x,0)))
             +highlight(texture2D(uCloud,vUv+vec2(0,d.y)))+highlight(texture2D(uCloud,vUv-vec2(0,d.y))));
    sum+=0.05*(highlight(texture2D(uCloud,vUv+d))+highlight(texture2D(uCloud,vUv-d))
              +highlight(texture2D(uCloud,vUv+vec2(d.x,-d.y)))+highlight(texture2D(uCloud,vUv+vec2(-d.x,d.y))));
    sum+=0.05*(highlight(texture2D(uCloud,vUv+vec2(2.0*d.x,0)))+highlight(texture2D(uCloud,vUv-vec2(2.0*d.x,0)))
              +highlight(texture2D(uCloud,vUv+vec2(0,2.0*d.y)))+highlight(texture2D(uCloud,vUv-vec2(0,2.0*d.y))));
    return sum;
  }
  void main() {
    vec4 cloud=texture2D(uCloud,vUv);
    if (uSilhouette) { gl_FragColor=vec4(vec3(0.0),cloud.a); return; }
    vec3 radiance=cloud.rgb;
    if (uBloomStrength > 0.0) radiance+=uBloomStrength*bloom(cloud);
    vec3 color=max(radiance/max(cloud.a,0.00001),vec3(0.0));
    if (uSimpleDisplay) {
      color*=uExposure;
      // Narkowicz's CC0 filmic fit, not the full ACES color transform.
      // https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
      color=uFilmicDisplay
        ? mix(color/(vec3(1.0)+color),clamp((color*(2.51*color+0.03))/(color*(2.43*color+0.59)+0.14),0.0,1.0),uFilmicStrength)
        : color/(vec3(1.0)+color);
      // Lift midtones together, with vanishing gain near the display ceiling.
      // For lift <= 0.25 this stays bounded without channel clipping.
      float y=dot(color,vec3(0.2126,0.7152,0.0722));
      float peak=max(color.r,max(color.g,color.b));
      color*=1.0+uMidtoneLift*4.0*(1.0-y)*(1.0-peak);
      gl_FragColor=vec4(color,cloud.a);
      #include <colorspace_fragment>
      return;
    }
    float luminance=dot(color,vec3(0.2126,0.7152,0.0722));
    vec3 chroma=color-vec3(luminance);
    // Staged saturation response driven by illumination, not extra noise:
    // establish weak color quickly, retain a broad graded middle, then reserve
    // peak saturation for the strongest color. Smooth joins avoid contour bands.
    float sourcePeak=max(color.r,max(color.g,color.b));
    float sourceLow=min(color.r,min(color.g,color.b));
    float sourceSat=(sourcePeak-sourceLow)/max(sourcePeak,0.00001);
    float targetSat=0.24*smoothstep(0.03,0.18,sourceSat)
                   +0.55*smoothstep(0.22,0.55,sourceSat)
                   +0.15*smoothstep(0.50,0.90,sourceSat);
    targetSat=min(targetSat*uSaturation,0.96);
    // Solve for chroma scaling at constant luminance, rather than clipping a
    // channel to zero and flattening all strongly illuminated billows.
    float highChroma=sourcePeak-luminance;
    float chromaScale=targetSat*luminance/max(
      sourcePeak-sourceLow-targetSat*highChroma,0.00001);
    color=max(vec3(luminance)+chroma*chromaScale,vec3(0.0))*uExposure;
    // Map luminance, not the strongest channel. Saturated cyan/pink should
    // retain the same shading contrast as neutral regions at equal luminance.
    float Y=luminance*uExposure;
    // The reference pink has a lower luminance than its cyan highlight.
    // A continuous shoulder avoids the dark contour produced by switching
    // calibration on over a narrow chroma interval. Neutral shading stays neutral.
    float pinkChroma=max(color.r-color.g,0.0);
    float pink=pinkChroma/(pinkChroma+0.15);
    float ceiling=mix(0.98,0.88,pink);
    float mapped=clamp((Y*(2.51*Y+0.03))/(Y*(2.43*Y+0.59)+0.14),0.0,0.98);
    // Reserve luminance headroom for chromatic highlights, especially cyan.
    // Neutral ambient shading retains its existing display curve.
    float gradedPeak=max(color.r,max(color.g,color.b));
    float gradedLow=min(color.r,min(color.g,color.b));
    float chromatic=smoothstep(0.12,0.45,(gradedPeak-gradedLow)/max(gradedPeak,0.00001));
    mapped*=mix(1.0,mix(0.86,0.625,pink),chromatic);
    color*=mapped/max(Y,0.00001);
    // Fit bright colors into display gamut by compressing chroma around their
    // luminance. Avoid channel clipping and the flattened patches it produces.
    vec3 displayChroma=color-vec3(mapped);
    float high=max(displayChroma.r,max(displayChroma.g,displayChroma.b));
    float gamut=min(1.0,(ceiling-mapped)/max(high,0.00001));
    color=vec3(mapped)+displayChroma*gamut;
    gl_FragColor=vec4(color,cloud.a);
    #include <colorspace_fragment>
  }
`;

// Low-resolution floor irradiance cache. Reuses the cloud's exact moving
// density, but integrates only the segment between each floor point and light.
export const floorLightingFragment = /* glsl */ `
  precision highp sampler3D;
  uniform sampler3D uDensity;
  uniform sampler2D uShape;
  uniform vec2 uEdgeWidths;
  uniform float uTime;
  uniform vec3 uLightPosition[2];
  uniform vec3 uLightDirection[2];
  uniform vec2 uLightCone[2];
  uniform vec2 uPower;
  uniform vec2 uLightRange;
  uniform vec2 uLightDecay;
  uniform float uLightExtinction;
  uniform float uFloorY;
  const vec3 BOUNDS=vec3(2.05,1.2,1.55);
  varying vec2 vUv;
  ${densityFunctions}
  void main() {
    vec3 p=vec3((vUv.x-0.5)*16.0,uFloorY,(vUv.y-0.5)*16.0);
    vec2 irradiance=vec2(0.0);
    for (int light=0;light<2;light++) {
      vec3 delta=uLightPosition[light]-p;
      float distanceToLight=max(length(delta),0.0001);
      vec3 L=delta/distanceToLight;
      float cone=smoothstep(uLightCone[light].x,uLightCone[light].y,dot(-L,uLightDirection[light]));
      if (cone<0.0001 || uPower[light]<=0.0 || L.y<=0.0) continue;
      float incident=uPower[light]*cone*L.y/pow(max(distanceToLight,sqrt(0.1)),uLightDecay[light]);
      if (uLightRange[light]>0.0) {
        float cutoff=clamp(1.0-pow(distanceToLight/uLightRange[light],4.0),0.0,1.0);
        incident*=cutoff*cutoff;
      }
      vec2 hit=intersectBox(p,L);
      float start=max(hit.x,0.0), end=min(hit.y,distanceToLight);
      float tau=0.0;
      if (end>start) {
        float ds=(end-start)/12.0;
        for (int j=0;j<12;j++) tau+=density(p+L*(start+(float(j)+0.5)*ds),false)*ds;
      }
      irradiance[light]=incident*exp(-tau*uLightExtinction);
    }
    gl_FragColor=vec4(irradiance,0.0,1.0);
  }
`;
