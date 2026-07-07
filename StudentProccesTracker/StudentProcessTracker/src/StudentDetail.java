public class StudentDetail {
    String name, reg;
    int java, os, cn, dnet, dbms;
    int total;
    double avg;
    String grade;

    public StudentDetail(String name, String reg, int java, int os, int cn, int dnet, int dbms) {

        this.name = name;
        this.reg = reg;
        this.java = java;
        this.os = os;
        this.cn = cn;
        this.dnet = dnet;
        this.dbms = dbms;

        total = java + os + cn + dnet + dbms;
        avg = total / 5.0;

        if (avg >= 90) grade = "A+";
        else if (avg >= 75) grade = "A";
        else if (avg >= 60) grade = "B";
        else if (avg >= 40) grade = "C";
        else grade = "Fail";
    }
}

