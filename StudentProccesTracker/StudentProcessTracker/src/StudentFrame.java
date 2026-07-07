// import java.awt.GridLayout;
import java.awt.Color;
import java.awt.GridLayout;
import java.awt.event.*;
import javax.swing.*;

public class StudentFrame extends JFrame{

   

    public StudentFrame(int width, int height){
        setTitle("Student Mark Process");
        setSize(width,height);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        ImageIcon image = new ImageIcon("image.png");
        setIconImage(image.getImage());
        getContentPane().setBackground(new Color(24, 25, 45));

        JMenu fact = new JMenu("Faculty-Login");
        JMenu stud = new JMenu("Student-Login");
         
        JMenuBar menu = new JMenuBar();
        JMenu Dept = new JMenu("Institue");
        ImageIcon Image = new ImageIcon("image,png");
        Dept.setIcon(Image);
        JMenu kgcas = new JMenu("KGCAS");
        JMenu kite = new JMenu("KITE"); 
        JMenu iim = new JMenu("KG-IIM");  
        JMenuItem mcaa = new JMenuItem("MCA-A");
        JMenuItem mcab = new JMenuItem ("MCA-B");  
         menu.add(fact);
         fact.addMouseListener(new MouseAdapter() {
    public void mouseClicked(MouseEvent e) {
        new FacultieView(); 
    }
});
        menu.add(stud);
        menu.add(Dept);
        setJMenuBar(menu);
        Dept.add(kgcas);
        Dept.add(kite);
        Dept.add(iim);
        iim.add(mcaa);
        iim.add(mcab);
        setVisible(true);

        
        menu.add(Box.createHorizontalGlue());
         JMenu home = new JMenu("Home");
         JMenu contact = new JMenu("Contact");
         menu.add(home);
         menu.add(contact);

         mcaa.addActionListener(e -> openStudentForm());
        mcab.addActionListener(e -> openStudentForm());

    }

     private static void openStudentForm() {
        JFrame form = new JFrame(" - Student Marks Entry");
        form.setSize(600, 400);
        form.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
        form.setLayout(new GridLayout(8, 3, 10, 10));
        form.setLocationRelativeTo(null);
        form.getContentPane().setBackground(new Color(24, 25, 45));
        ImageIcon image2 = new ImageIcon("image.png");
        form.setIconImage(image2.getImage());


        JLabel nameLabel = new JLabel("Student Name:");
        nameLabel.setForeground(Color.WHITE);
        JTextField nameField = new JTextField();

        JLabel regLabel = new JLabel("Register Number:");
        regLabel.setForeground(Color.WHITE);
        JTextField regField = new JTextField();

        JLabel javaLabel = new JLabel("Java Marks:");
        JTextField javaField = new JTextField();
        javaLabel.setForeground(Color.WHITE);

        JLabel osLabel = new JLabel("OS Marks:");
        osLabel.setForeground(Color.WHITE);
        JTextField osField = new JTextField();

        JLabel cnLabel = new JLabel("CN Marks:");
        cnLabel.setForeground(Color.WHITE);
        JTextField cnField = new JTextField();

        JLabel dnetLabel = new JLabel(". NET Marks:");
        dnetLabel.setForeground(Color.WHITE);
        JTextField dnetField = new JTextField();

        JLabel dbmsLabel = new JLabel("DBMS Marks:");
        dbmsLabel.setForeground(Color.WHITE);
        JTextField dbmsField = new JTextField();

        JButton submitBtn = new JButton("Submit");

        
        form.add(nameLabel); form.add(nameField);
        form.add(regLabel); form.add(regField);
        form.add(javaLabel); form.add(javaField);
        form.add(osLabel); form.add(osField);
        form.add(cnLabel); form.add(cnField);
        form.add(dnetLabel); form.add(dnetField);
        form.add(dbmsLabel); form.add(dbmsField);
        form.add(new JLabel("")); form.add(submitBtn);
        form.setVisible(true);

  
       submitBtn.addActionListener((ActionEvent e) -> {
    try {
        String name1 = nameField.getText();
        String reg = regField.getText();
        int java = Integer.parseInt(javaField.getText());
        int os = Integer.parseInt(osField.getText());
        int cn = Integer.parseInt(cnField.getText());
        int dnet = Integer.parseInt(dnetField.getText());
        int dbms = Integer.parseInt(dbmsField.getText());

       
        StudentDetail s = new StudentDetail(name1, reg, java, os, cn, dnet, dbms);
        StudentDatabase.addStudent(s);

        JOptionPane.showMessageDialog(form, "Student Added Successfully!");

        form.dispose(); 

    } catch (Exception ex) {
        JOptionPane.showMessageDialog(form, "Please enter valid marks!", "Error", JOptionPane.ERROR_MESSAGE);
    }
});

    }

    
     public static void main(String[] args) {
    StudentFrame frame = new StudentFrame(600, 400);
    frame.setVisible(true);
}
}
    

   





 
