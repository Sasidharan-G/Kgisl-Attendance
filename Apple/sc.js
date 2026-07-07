const images=["Img - AirPods Max in color - Purple, shot from front. → Picture → airpods_max_purple__d9y3g3n7cnyq_large.png.svg","airpods-max-select-skyblue-202011 1.png","pngaaa (1).png","pngaaa 1.png","pngaaa.png"];

function ChangeImage(){
    const random=Math.floor(Math.random() * images.length);
    document.getElementById("randomImage").src = images[random];
}

setInterval(ChangeImage, 500);


       document.getElementById("mybut").addEventListener("click"), function () {
    
      document.location.href="checkout.html";
       }
    